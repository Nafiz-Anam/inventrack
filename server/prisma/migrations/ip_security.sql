-- Create IP security management tables
-- This migration adds tables for dynamic IP whitelist/blacklist management

-- IP Security Rules table
CREATE TABLE "ip_security_rules" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "cidr_range" TEXT,
    "rule_type" "IPSecurityRuleType" NOT NULL,
    "reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "ip_security_rules_pkey" PRIMARY KEY ("id")
);

-- IP Security Analytics table
CREATE TABLE "ip_security_analytics" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "country_code" TEXT,
    "reputation" TEXT,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "first_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" TEXT,
    "risk_score" REAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "ip_security_analytics_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "ip_security_rules_ip_address_idx" ON "ip_security_rules"("ip_address");
CREATE INDEX "ip_security_rules_rule_type_idx" ON "ip_security_rules"("rule_type");
CREATE INDEX "ip_security_rules_is_active_idx" ON "ip_security_rules"("is_active");
CREATE INDEX "ip_security_analytics_ip_address_idx" ON "ip_security_analytics"("ip_address");
CREATE INDEX "ip_security_analytics_is_blocked_idx" ON "ip_security_analytics"("is_blocked");

-- IPSecurityRuleType enum
CREATE TYPE "IPSecurityRuleType" AS ENUM ('WHITELIST', 'BLACKLIST', 'SUSPICIOUS');
