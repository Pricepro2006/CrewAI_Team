# Comprehensive Monitoring and Observability for CrewAI Team Microservices
# Cost-optimized monitoring with intelligent alerting

# CloudWatch Dashboard for Service Mesh
resource "aws_cloudwatch_dashboard" "microservices" {
  dashboard_name = "${var.project_name}-microservices-overview"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            for service_name in keys(var.microservices) : [
              "AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-${service_name}", "ClusterName", aws_ecs_cluster.main.name
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service CPU Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            for service_name in keys(var.microservices) : [
              "AWS/ECS", "MemoryUtilization", "ServiceName", "${var.project_name}-${service_name}", "ClusterName", aws_ecs_cluster.main.name
            ]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Service Memory Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view   = "timeSeries"
          stacked = false
          region = var.aws_region
          title  = "Load Balancer Metrics"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            for service_name in keys(var.microservices) : [
              "AWS/ECS", "RunningTaskCount", "ServiceName", "${var.project_name}-${service_name}", "ClusterName", aws_ecs_cluster.main.name
            ]
          ]
          view   = "timeSeries"
          stacked = false
          region = var.aws_region
          title  = "Running Task Counts"
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6
        
        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${aws_elasticache_replication_group.redis.replication_group_id}-001"],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "CurrConnections", ".", "."]
          ]
          view   = "timeSeries"
          stacked = false
          region = var.aws_region
          title  = "Redis Cache Metrics"
          period = 300
        }
      }
    ]
  })
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
  
  tags = {
    Name = "${var.project_name}-alerts"
  }
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count = var.environment == "prod" ? 1 : 0
  
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "devops@example.com"  # Replace with actual email
}

# CloudWatch Alarms - Service Health
resource "aws_cloudwatch_metric_alarm" "service_cpu_high" {
  for_each = var.microservices
  
  alarm_name          = "${var.project_name}-${each.key}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = each.value.cpu_target_value + 10  # 10% above target
  alarm_description   = "This metric monitors ${each.key} cpu utilization"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    ServiceName = aws_ecs_service.microservices[each.key].name
    ClusterName = aws_ecs_cluster.main.name
  }
  
  tags = {
    Name    = "${var.project_name}-${each.key}-cpu-alarm"
    Service = each.key
  }
}

resource "aws_cloudwatch_metric_alarm" "service_memory_high" {
  for_each = var.microservices
  
  alarm_name          = "${var.project_name}-${each.key}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors ${each.key} memory utilization"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    ServiceName = aws_ecs_service.microservices[each.key].name
    ClusterName = aws_ecs_cluster.main.name
  }
  
  tags = {
    Name    = "${var.project_name}-${each.key}-memory-alarm"
    Service = each.key
  }
}

# Service Availability Alarms
resource "aws_cloudwatch_metric_alarm" "service_running_tasks_low" {
  for_each = var.microservices
  
  alarm_name          = "${var.project_name}-${each.key}-tasks-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RunningTaskCount"
  namespace           = "AWS/ECS"
  period              = "60"
  statistic           = "Average"
  threshold           = each.value.min_capacity
  alarm_description   = "This metric monitors ${each.key} running task count"
  treat_missing_data  = "breaching"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    ServiceName = aws_ecs_service.microservices[each.key].name
    ClusterName = aws_ecs_cluster.main.name
  }
  
  tags = {
    Name    = "${var.project_name}-${each.key}-availability-alarm"
    Service = each.key
  }
}

# Load Balancer Health Alarms
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  alarm_name          = "${var.project_name}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2.0"  # 2 seconds
  alarm_description   = "This metric monitors ALB response time"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
  
  tags = {
    Name = "${var.project_name}-alb-response-time-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors_high" {
  alarm_name          = "${var.project_name}-alb-5xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors ALB 5XX errors"
  treat_missing_data  = "notBreaching"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }
  
  tags = {
    Name = "${var.project_name}-alb-5xx-alarm"
  }
}

# Redis Cache Health
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${var.project_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }
  
  tags = {
    Name = "${var.project_name}-redis-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${var.project_name}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors Redis memory utilization"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.redis.replication_group_id}-001"
  }
  
  tags = {
    Name = "${var.project_name}-redis-memory-alarm"
  }
}

# Cost Anomaly Detection
resource "aws_ce_anomaly_detector" "microservices_cost" {
  count = var.environment == "prod" ? 1 : 0
  
  name     = "${var.project_name}-cost-anomaly"
  monitor_type = "DIMENSIONAL"
  
  specification = jsonencode({
    Dimension = "SERVICE"
    MatchOptions = ["EQUALS"]
    Values = ["Amazon Elastic Container Service - Compute"]
  })
}

resource "aws_ce_anomaly_subscription" "microservices_cost" {
  count = var.environment == "prod" ? 1 : 0
  
  name      = "${var.project_name}-cost-alerts"
  frequency = "DAILY"
  
  monitor_arn_list = [
    aws_ce_anomaly_detector.microservices_cost[0].arn
  ]
  
  subscriber {
    type    = "EMAIL"
    address = "devops@example.com"  # Replace with actual email
  }
  
  threshold_expression {
    and {
      dimension {
        key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
        values        = ["100"]
        match_options = ["GREATER_THAN_OR_EQUAL"]
      }
    }
  }
}

# Custom Application Metrics (if using CloudWatch Agent)
resource "aws_cloudwatch_log_metric_filter" "nlp_processing_time" {
  name           = "${var.project_name}-nlp-processing-time"
  log_group_name = aws_cloudwatch_log_group.ecs.name
  pattern        = "[timestamp, request_id, level=\"INFO\", service=\"NLP_SERVICE\", ..., processing_time]"
  
  metric_transformation {
    name      = "NLPProcessingTime"
    namespace = "CrewAI/Microservices"
    value     = "$processing_time"
  }
}

resource "aws_cloudwatch_metric_alarm" "nlp_processing_time_high" {
  alarm_name          = "${var.project_name}-nlp-processing-slow"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "NLPProcessingTime"
  namespace           = "CrewAI/Microservices"
  period              = "300"
  statistic           = "Average"
  threshold           = "2000"  # 2 seconds
  alarm_description   = "NLP processing is taking too long"
  treat_missing_data  = "notBreaching"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  tags = {
    Name = "${var.project_name}-nlp-performance-alarm"
  }
}

# Service-specific dashboards
resource "aws_cloudwatch_dashboard" "nlp_service_detailed" {
  dashboard_name = "${var.project_name}-nlp-service-detail"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["CrewAI/Microservices", "NLPProcessingTime"],
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.project_name}-nlp-service", "ClusterName", aws_ecs_cluster.main.name],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view   = "timeSeries"
          stacked = false
          region = var.aws_region
          title  = "NLP Service Performance"
          period = 300
        }
      }
    ]
  })
}

# Composite Alarm for Service Health
resource "aws_cloudwatch_composite_alarm" "service_health" {
  for_each = var.microservices
  
  alarm_name        = "${var.project_name}-${each.key}-service-health"
  alarm_description = "Composite alarm for ${each.key} service health"
  
  alarm_rule = "ALARM(${aws_cloudwatch_metric_alarm.service_cpu_high[each.key].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.service_memory_high[each.key].alarm_name}) OR ALARM(${aws_cloudwatch_metric_alarm.service_running_tasks_low[each.key].alarm_name})"
  
  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  ok_actions    = var.environment == "prod" ? [aws_sns_topic.alerts.arn] : []
  
  depends_on = [
    aws_cloudwatch_metric_alarm.service_cpu_high,
    aws_cloudwatch_metric_alarm.service_memory_high,
    aws_cloudwatch_metric_alarm.service_running_tasks_low
  ]
  
  tags = {
    Name    = "${var.project_name}-${each.key}-health"
    Service = each.key
  }
}