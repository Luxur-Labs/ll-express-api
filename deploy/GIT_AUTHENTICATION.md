# Git Authentication Setup for EC2

This guide helps you set up Git authentication on your EC2 instance to clone and pull from your GitHub repository.

## Quick Solution: Use SSH (Recommended)

SSH is the most secure and convenient method for Git operations.

### Step 1: Generate SSH Key on EC2

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"
# Press Enter to accept default location (~/.ssh/id_ed25519)
# Optionally set a passphrase for extra security

# Display the public key
cat ~/.ssh/id_ed25519.pub
```

### Step 2: Add SSH Key to GitHub

1. Copy the entire output from `cat ~/.ssh/id_ed25519.pub`
2. Go to GitHub.com → Your Profile → Settings
3. Click "SSH and GPG keys" in the left sidebar
4. Click "New SSH key"
5. Give it a title (e.g., "EC2 Production Server")
6. Paste your public key
7. Click "Add SSH key"

### Step 3: Test SSH Connection

```bash
# Test GitHub SSH connection
ssh -T git@github.com
# You should see: "Hi saikumar41! You've successfully authenticated..."
```

### Step 4: Clone Repository

```bash
# Now you can clone using SSH
git clone git@github.com:saikumar41/ll-express-api.git .
```

## Alternative: Personal Access Token (HTTPS)

If you prefer HTTPS or can't use SSH:

### Step 1: Create Personal Access Token

1. Go to GitHub.com → Your Profile → Settings
2. Click "Developer settings" (bottom left)
3. Click "Personal access tokens" → "Tokens (classic)"
4. Click "Generate new token" → "Generate new token (classic)"
5. Give it a name: "EC2 Deployment"
6. Select expiration (recommend 90 days or custom)
7. Select scopes:
   - For **private repos**: Check `repo` (all repo permissions)
   - For **public repos**: Check `public_repo`
8. Click "Generate token"
9. **Copy the token immediately** (you won't see it again!)

### Step 2: Clone Repository

**Option A: Enter token when prompted**
```bash
git clone https://github.com/saikumar41/ll-express-api.git .
# Username: saikumar41
# Password: <paste your token>
```

**Option B: Embed token in URL (less secure)**
```bash
git clone https://YOUR_TOKEN@github.com/saikumar41/ll-express-api.git .
```

**Option C: Configure Git credential helper**
```bash
# Configure Git to store credentials
git config --global credential.helper store

# Clone (enter username and token once)
git clone https://github.com/saikumar41/ll-express-api.git .

# Future git pull commands will use stored credentials
```

### Step 3: Update Existing Repository

If you already cloned and need to authenticate:

```bash
cd /var/www/ll-express-api

# Update remote URL with token
git remote set-url origin https://YOUR_TOKEN@github.com/saikumar41/ll-express-api.git

# Or use credential helper
git config credential.helper store
git pull
# Enter username and token when prompted
```

## Troubleshooting

### "Permission denied (publickey)" Error

- Verify SSH key is added to GitHub: Check GitHub → Settings → SSH keys
- Test connection: `ssh -T git@github.com`
- Check SSH agent: `ssh-add -l`
- Add key to agent: `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519`

### "Invalid username or token" Error

- Verify token has correct scopes (`repo` for private repos)
- Check token hasn't expired
- Ensure token is copied correctly (no extra spaces)
- Try regenerating the token

### "Authentication failed" with HTTPS

- Use personal access token, not your GitHub password
- Ensure token has `repo` scope for private repositories
- Check if token expired
- Verify repository URL is correct

### Store Credentials Securely

For production, consider using AWS Secrets Manager:

```bash
# Install AWS CLI
sudo apt install awscli

# Store token in AWS Secrets Manager (from your local machine)
aws secretsmanager create-secret \
  --name ec2/github-token \
  --secret-string "your-github-token"

# Retrieve on EC2 (requires IAM role with secrets access)
GITHUB_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id ec2/github-token \
  --query SecretString --output text)

git clone https://$GITHUB_TOKEN@github.com/saikumar41/ll-express-api.git .
```

## Best Practices

1. **Use SSH for production** - More secure and convenient
2. **Use different keys per server** - Easier to revoke access
3. **Set token expiration** - Rotate tokens regularly
4. **Use least privilege** - Only grant necessary scopes
5. **Never commit tokens** - Use environment variables or secrets manager
6. **Monitor token usage** - Check GitHub → Settings → Personal access tokens regularly

## Quick Reference

```bash
# SSH Setup (One-time)
ssh-keygen -t ed25519 -C "email@example.com"
cat ~/.ssh/id_ed25519.pub  # Copy and add to GitHub

# Clone with SSH
git clone git@github.com:saikumar41/ll-express-api.git .

# Clone with HTTPS + Token
git clone https://TOKEN@github.com/saikumar41/ll-express-api.git .

# Configure credential storage
git config --global credential.helper store
```

