# Advanced Auto-Scaling Policies for CrewAI Team Microservices
# Implements multi-metric scaling with cost optimization

# Memory-based scaling policy for NLP service (AI workload)
resource "aws_appautoscaling_policy" "nlp_memory_scaling" {
  name               = "${var.project_name}-nlp-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.microservices["nlp-service"].resource_id
  scalable_dimension = aws_appautoscaling_target.microservices["nlp-service"].scalable_dimension
  service_namespace  = aws_appautoscaling_target.microservices["nlp-service"].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    
    target_value       = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 180  # Faster scale-out for AI workload
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

# Request-based scaling for grocery service
resource "aws_appautoscaling_policy" "grocery_request_scaling" {
  name               = "${var.project_name}-grocery-request"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.microservices["grocery-service"].resource_id
  scalable_dimension = aws_appautoscaling_target.microservices["grocery-service"].scalable_dimension
  service_namespace  = aws_appautoscaling_target.microservices["grocery-service"].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label        = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.microservices["grocery-service"].arn_suffix}"
    }
    
    target_value       = 1000.0  # Requests per minute per instance
    scale_in_cooldown  = 300
    scale_out_cooldown = 300
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

# Scheduled scaling for predictable traffic patterns
resource "aws_appautoscaling_scheduled_action" "business_hours_scale_out" {
  for_each = {
    for k, v in var.microservices : k => v if v.max_capacity > v.min_capacity
  }
  
  name               = "${var.project_name}-${each.key}-business-hours"
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.microservices[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  
  # Scale out at 8 AM EST (Monday-Friday)
  schedule           = "cron(0 13 ? * MON-FRI *)"  # 13:00 UTC = 8:00 AM EST
  
  scalable_target_action {
    min_capacity = each.value.min_capacity
    max_capacity = each.value.max_capacity
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

resource "aws_appautoscaling_scheduled_action" "off_hours_scale_in" {
  for_each = {
    for k, v in var.microservices : k => v if v.max_capacity > v.min_capacity
  }
  
  name               = "${var.project_name}-${each.key}-off-hours"
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.microservices[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  
  # Scale in at 8 PM EST (Monday-Friday) and all weekend
  schedule           = "cron(0 1 ? * TUE-SAT *)"   # 01:00 UTC = 8:00 PM EST
  
  scalable_target_action {
    min_capacity = each.value.min_capacity
    max_capacity = max(1, each.value.min_capacity)  # Ensure at least 1 instance
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

# Step scaling policy for rapid traffic spikes
resource "aws_appautoscaling_policy" "pricing_step_scaling" {
  name               = "${var.project_name}-pricing-step"
  policy_type        = "StepScaling"
  resource_id        = aws_appautoscaling_target.microservices["pricing-service"].resource_id
  scalable_dimension = aws_appautoscaling_target.microservices["pricing-service"].scalable_dimension
  service_namespace  = aws_appautoscaling_target.microservices["pricing-service"].service_namespace
  
  step_scaling_policy_configuration {
    adjustment_type         = "ChangeInCapacity"
    cooldown               = 300
    metric_aggregation_type = "Average"
    
    step_adjustment {
      metric_interval_lower_bound = 0
      metric_interval_upper_bound = 50
      scaling_adjustment          = 1
    }
    
    step_adjustment {
      metric_interval_lower_bound = 50
      metric_interval_upper_bound = 80
      scaling_adjustment          = 2
    }
    
    step_adjustment {
      metric_interval_lower_bound = 80
      scaling_adjustment          = 3
    }
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

# CloudWatch Alarms for step scaling
resource "aws_cloudwatch_metric_alarm" "pricing_cpu_high" {
  alarm_name          = "${var.project_name}-pricing-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "This metric monitors pricing service cpu utilization"
  alarm_actions       = [aws_appautoscaling_policy.pricing_step_scaling.arn]
  
  dimensions = {
    ServiceName = aws_ecs_service.microservices["pricing-service"].name
    ClusterName = aws_ecs_cluster.main.name
  }
  
  tags = {
    Name    = "${var.project_name}-pricing-cpu-alarm"
    Service = "pricing-service"
  }
}

# Cost optimization: Scale down aggressively during low usage
resource "aws_appautoscaling_policy" "cost_optimization_scale_in" {
  for_each = var.microservices
  
  name               = "${var.project_name}-${each.key}-cost-optimization"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.microservices[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.microservices[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.microservices[each.key].service_namespace
  
  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    
    # Aggressive scale-in threshold for cost optimization
    target_value       = 30.0
    scale_in_cooldown  = 900  # 15 minutes - longer to prevent thrashing
    scale_out_cooldown = 180  # 3 minutes - faster scale-out for user experience
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

# Weekend scaling schedule (minimal capacity)
resource "aws_appautoscaling_scheduled_action" "weekend_scale_down" {
  for_each = {
    for k, v in var.microservices : k => v if k != "nlp-service" # Keep NLP service running
  }
  
  name               = "${var.project_name}-${each.key}-weekend"
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.microservices[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  
  # Scale down on Saturday at midnight
  schedule           = "cron(0 5 ? * SAT *)"  # 05:00 UTC = 12:00 AM EST Saturday
  
  scalable_target_action {
    min_capacity = 1  # Minimal capacity for cost savings
    max_capacity = 2
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}

resource "aws_appautoscaling_scheduled_action" "weekend_scale_up" {
  for_each = {
    for k, v in var.microservices : k => v if k != "nlp-service"
  }
  
  name               = "${var.project_name}-${each.key}-monday"
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.microservices[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  
  # Scale back up on Monday at 6 AM EST
  schedule           = "cron(0 11 ? * MON *)"  # 11:00 UTC = 6:00 AM EST Monday
  
  scalable_target_action {
    min_capacity = each.value.min_capacity
    max_capacity = each.value.max_capacity
  }
  
  depends_on = [aws_appautoscaling_target.microservices]
}