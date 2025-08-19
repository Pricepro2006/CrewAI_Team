# Outputs for CrewAI Team Microservices Infrastructure

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

# Load Balancer
output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

# ECS Cluster
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

# Service URLs
output "service_endpoints" {
  description = "Service endpoint URLs"
  value = {
    for service_name, service_config in var.microservices :
    service_name => "http://${aws_lb.main.dns_name}/${service_name}/"
  }
}

# CloudWatch Log Group
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.arn
}

# Redis
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_replication_group.redis.port
}

# Security Groups
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group" 
  value       = aws_security_group.ecs.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

# IAM Roles
output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task.arn
}

# Cost Estimation
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    fargate_compute = "~$120-180/month (${sum([for k, v in var.microservices : v.cpu * v.min_capacity * 24 * 30 * 0.04048])} vCPU-hours)"
    fargate_memory  = "~$15-25/month (${sum([for k, v in var.microservices : v.memory * v.min_capacity * 24 * 30 * 0.004445])} GB-hours)"
    load_balancer   = "~$22/month (1 ALB)"
    nat_gateway     = "~$32/month (1 NAT Gateway)"
    redis_cache     = "~$12/month (cache.t3.micro)"
    data_transfer   = "~$5-10/month (estimated)"
    cloudwatch      = "~$5/month (logs + metrics)"
    
    total_estimated = "$180-250/month"
    
    cost_optimization_notes = [
      "70% Fargate Spot instances for additional 50-70% savings",
      "Single NAT Gateway saves ~$32/month vs multi-AZ",
      "Right-sized instances based on actual usage patterns",
      "Auto-scaling reduces idle costs during low traffic"
    ]
  }
}

# Service Health Check URLs
output "health_check_urls" {
  description = "Health check URLs for each service"
  value = {
    for service_name, service_config in var.microservices :
    service_name => "http://${aws_lb.main.dns_name}/${service_name}${service_config.health_path}"
  }
}

# Monitoring and Scaling
output "autoscaling_targets" {
  description = "Auto-scaling target information"
  value = {
    for service_name, service_config in var.microservices :
    service_name => {
      min_capacity      = service_config.min_capacity
      max_capacity      = service_config.max_capacity
      cpu_target_value  = service_config.cpu_target_value
    }
  }
}

# Environment Information
output "environment_info" {
  description = "Deployment environment information"
  value = {
    environment     = var.environment
    project_name    = var.project_name
    region         = var.aws_region
    deployment_time = timestamp()
    
    spot_instances_enabled = var.enable_spot_instances
    spot_allocation       = "${var.spot_allocation_percentage}%"
    
    services_count = length(var.microservices)
    total_min_capacity = sum([for k, v in var.microservices : v.min_capacity])
    total_max_capacity = sum([for k, v in var.microservices : v.max_capacity])
  }
}

# Connection Strings (for application configuration)
output "connection_strings" {
  description = "Connection strings for services"
  value = {
    redis_connection_string = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
    
    service_discovery_endpoints = {
      for service_name, service_config in var.microservices :
      service_name => {
        internal_endpoint = "${service_name}.${aws_ecs_cluster.main.name}.local:${service_config.port}"
        external_endpoint = "http://${aws_lb.main.dns_name}/${service_name}/"
        health_endpoint  = "http://${aws_lb.main.dns_name}/${service_name}${service_config.health_path}"
      }
    }
  }
}

# Terraform State Information
output "terraform_state_info" {
  description = "Information about Terraform state management"
  value = {
    backend_bucket = "crewai-terraform-state"
    state_key     = "microservices/terraform.tfstate"
    region        = var.aws_region
    
    management_commands = [
      "terraform plan -var-file=environments/${var.environment}.tfvars",
      "terraform apply -var-file=environments/${var.environment}.tfvars",
      "terraform destroy -var-file=environments/${var.environment}.tfvars"
    ]
  }
}