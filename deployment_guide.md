# Deploying CampusVerify to nust.retrax.co via Cloudflare Tunnel

## Prerequisites
- Domain `retrax.co` added to your Cloudflare account
- Logged into Cloudflare dashboard

---

## Step 1: Install Cloudflared

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

## Step 2: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```
> This opens a browser — select the **retrax.co** domain and authorize.

## Step 3: Create a Tunnel

```bash
cloudflared tunnel create nust-campusverify
```
> Save the **Tunnel ID** it gives you (e.g., `a1b2c3d4-...`).

## Step 4: Create DNS Route

```bash
cloudflared tunnel route dns nust-campusverify nust.retrax.co
```
> This creates a CNAME record pointing `nust.retrax.co` → your tunnel.

## Step 5: Create Config File

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this (replace `TUNNEL_ID` with your actual tunnel ID):

```yaml
tunnel: TUNNEL_ID
credentials-file: /home/mehran/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: nust.retrax.co
    service: http://localhost:3000
  - service: http_status:404
```

## Step 6: Make Sure Server is Running

```bash
cd "/home/mehran/Downloads/Nust Hackathon"
node server/database.server.js &
```

## Step 7: Start the Tunnel

```bash
cloudflared tunnel run nust-campusverify
```

## Step 8: Verify

Visit **https://nust.retrax.co** — your app should be live! 🎉

---

## Run Tunnel in Background (Optional)

To keep it running after closing terminal:

```bash
# Option A: Using nohup
nohup cloudflared tunnel run nust-campusverify &

# Option B: Install as system service (persistent across reboots)
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```
