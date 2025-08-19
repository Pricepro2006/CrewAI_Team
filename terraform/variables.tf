# Variables for CrewAI Team Microservices Infrastructure

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "crewai-team"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "ecr_repository_url" {
  description = "ECR repository URL for container images"
  type        = string
  default     = "123456789012.dkr.ecr.us-east-1.amazonaws.com"  # Replace with actual ECR URL
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

# Microservices configuration with cost optimization
variable "microservices" {
  description = "Configuration for each microservice"
  type = map(object({
    port             = number
    health_path      = string
    cpu              = number
    memory           = number
    min_capacity     = number
    max_capacity     = number
    cpu_target_value = number
  }))
  
  default = {
    # Core services - always running
    "grocery-service" = {
      port             = 3005
      health_path      = "/health"
      cpu              = 256   # 0.25 vCPU
      memory           = 512   # 512 MB
      min_capacity     = 1
      max_capacity     = 3
      cpu_target_value = 70
    }
    
    "pricing-service" = {
      port             = 3007
      health_path      = "/health" 
      cpu              = 256   # 0.25 vCPU
      memory           = 512   # 512 MB
      min_capacity     = 1
      max_capacity     = 4
      cpu_target_value = 65
    }
    
    # NLP service - higher resources for AI workload
    "nlp-service" = {
      port             = 3008
      health_path      = "/health"
      cpu              = 1024  # 1 vCPU
      memory           = 2048  # 2 GB
      min_capacity     = 1
      max_capacity     = 2
      cpu_target_value = 75
    }
    
    # Utility services - lower resources
    "cache-warmer" = {
      port             = 3006
      health_path      = "/health"
      cpu              = 256   # 0.25 vCPU
      memory           = 512   # 512 MB  
      min_capacity     = 1
      max_capacity     = 2
      cpu_target_value = 80
    }
    
    "memory-monitor" = {
      port             = 3010
      health_path      = "/health"
      cpu              = 256   # 0.25 vCPU
      memory           = 256   # 256 MB
      min_capacity     = 1
      max_capacity     = 2
      cpu_target_value = 80
    }
  }
}

# Cost optimization settings
variable "enable_spot_instances" {
  description = "Use Fargate Spot instances for cost savings"
  type        = bool
  default     = true
}

variable "spot_allocation_percentage" {
  description = "Percentage of capacity to allocate to Spot instances"
  type        = number
  default     = 70
  
  validation {
    condition     = var.spot_allocation_percentage >= 0 && var.spot_allocation_percentage <= 100
    error_message = "Spot allocation percentage must be between 0 and 100."
  }
}

# Monitoring and alerting
variable "enable_container_insights" {
  description = "Enable CloudWatch Container Insights"
  type        = bool
  default     = true
}

variable "enable_enhanced_monitoring" {
  description = "Enable enhanced monitoring for RDS instances"
  type        = bool
  default     = false  # Disable for cost savings in dev
}

# Security settings
variable "enable_deletion_protection" {
  description = "Enable deletion protection for production resources"
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Backup retention period in days"
  type        = number
  default     = 7
}

# Auto-scaling configuration
variable "auto_scaling_enabled" {
  description = "Enable auto-scaling for services"
  type        = bool
  default     = true
}

variable "scale_in_cooldown" {
  description = "Scale-in cooldown period in seconds"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Scale-out cooldown period in seconds" 
  type        = number
  default     = 300
}

# Networking
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnets"
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Use single NAT Gateway for cost optimization"
  type        = bool
  default     = true  # Cost optimization: single NAT instead of per-AZ
}

# Redis configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_clusters" {
  description = "Number of cache clusters in Redis replication group"
  type        = number
  default     = 2
}

variable "redis_automatic_failover" {
  description = "Enable automatic failover for Redis"
  type        = bool
  default     = true
}

# Environment-specific overrides
variable "environment_config" {
  description = "Environment-specific configuration overrides"
  type = map(object({
    log_retention_days       = number
    enable_deletion_protection = bool
    redis_num_cache_clusters = number
    backup_retention_period  = number
  }))
  
  default = {
    dev = {
      log_retention_days         = 3
      enable_deletion_protection = false
      redis_num_cache_clusters   = 1
      backup_retention_period    = 1
    }
    
    staging = {
      log_retention_days         = 7
      enable_deletion_protection = false  
      redis_num_cache_clusters   = 2
      backup_retention_period    = 3
    }
    
    prod = {
      log_retention_days         = 30
      enable_deletion_protection = true
      redis_num_cache_clusters   = 3
      backup_retention_period    = 7
    }
  }
}