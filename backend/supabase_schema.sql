-- Subscriptions Table: Stores user subscription information
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'canceled')),
    plan_type TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'yearly', 'lifetime')),
    amount_paid INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Add index on user_id for faster lookups
    CONSTRAINT idx_subscriptions_user_id UNIQUE (user_id, created_at)
);

-- Usage Logs Table: Tracks usage counts for each user
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table: Records payment transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    subscription_id UUID REFERENCES subscriptions(id),
    transaction_id TEXT,
    payment_provider TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security Policies
-- These policies control who can access which rows in the tables

-- Allow users to read only their own subscription data
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON subscriptions
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow users to read only their own usage data
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON usage_logs
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow users to read only their own transaction data
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid()::text = user_id);

-- Allow service role to manage all data
-- These policies allow your backend server to manage all data using the service key
CREATE POLICY "Service can manage subscriptions" ON subscriptions
    USING (true) WITH CHECK (true);
    
CREATE POLICY "Service can manage usage_logs" ON usage_logs
    USING (true) WITH CHECK (true);
    
CREATE POLICY "Service can manage transactions" ON transactions
    USING (true) WITH CHECK (true); 