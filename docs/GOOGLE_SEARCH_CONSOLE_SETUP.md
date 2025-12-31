# Google Search Console Setup Guide

This guide will help you set up Google Search Console for fantasyphish.com to request re-indexing and monitor how your site appears in Google Search.

## Step 1: Access Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Sign in with your Google account

## Step 2: Add Your Property

### Option A: Domain Property (Recommended - covers all subdomains)

1. Click **Add Property**
2. Select **Domain** property type
3. Enter: `fantasyphish.com`
4. Click **Continue**
5. You'll need to verify ownership via DNS:
   - Copy the TXT record provided by Google
   - Add it to your DNS settings (where your domain is registered/managed)
   - Wait a few minutes for DNS propagation
   - Click **Verify**

### Option B: URL Prefix Property (Easier - covers specific URLs)

1. Click **Add Property**
2. Select **URL prefix** property type
3. Enter: `https://www.fantasyphish.com` or `https://fantasyphish.com`
4. Click **Continue**
5. Choose a verification method:

#### Verification Methods:

**Recommended: HTML file upload (if you have server access)**

- Download the HTML verification file
- Upload to your site's root directory at `/public/`
- Verify it's accessible at `https://fantasyphish.com/google[...].html`
- Click **Verify**

**Alternative: HTML tag**

- Copy the `<meta>` tag provided
- Add it to the `<head>` section of your site's layout.tsx
- Deploy the changes
- Click **Verify**

**Alternative: Google Analytics**

- If you already use Google Analytics on your site
- Select this method and verify

## Step 3: Request Indexing for Favicon Changes

After deploying your favicon updates:

1. In Google Search Console, go to **URL Inspection** (left sidebar)
2. Enter your homepage URL: `https://fantasyphish.com`
3. Click **Request Indexing**
4. Google will crawl your site and update the favicon (may take a few days to appear in search results)

## Step 4: Submit Your Sitemap

1. In Google Search Console, go to **Sitemaps** (left sidebar)
2. Enter: `sitemap.xml`
3. Click **Submit**

Your site already has a sitemap at `/sitemap.ts` that Next.js generates automatically.

## Step 5: Monitor Your Site

After setup, you can:

- **Performance**: See search queries, clicks, impressions, CTR
- **Coverage**: Check which pages are indexed
- **Enhancements**: Monitor mobile usability, page experience
- **URL Inspection**: Debug individual page indexing issues

## Expected Timeline

- **Verification**: Immediate (once DNS/file is in place)
- **Favicon Update in Search**: 1-7 days after requesting indexing
- **Full Site Crawl**: Can take days to weeks depending on site size

## Troubleshooting

### Verification Failed

- **DNS Method**: Wait 10-15 minutes for DNS propagation, try again
- **HTML File**: Make sure the file is accessible publicly (not blocked by robots.txt)
- **HTML Tag**: Ensure the tag is in the `<head>` section and deployed

### Favicon Not Updating

- Request re-indexing of your homepage specifically
- Clear your browser cache
- Check that favicon files are publicly accessible:
  - `https://fantasyphish.com/favicon.ico`
  - `https://fantasyphish.com/apple-touch-icon.png`
- Google may cache old icons for a few days

### Need Help?

- [Google Search Console Help Center](https://support.google.com/webmasters)
- [Search Console Community](https://support.google.com/webmasters/community)

## Quick Verification Check

After deploying, test these URLs are accessible:

- https://fantasyphish.com/favicon.ico
- https://fantasyphish.com/favicon-16x16.png
- https://fantasyphish.com/favicon-32x32.png
- https://fantasyphish.com/apple-touch-icon.png
- https://fantasyphish.com/manifest.json

All should return the donut logo or manifest JSON (not 404 errors).
