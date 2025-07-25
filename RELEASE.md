# Automated Release Instructions

This repository uses GitHub Actions to automatically create releases when new tags are pushed. The workflow is configured to trigger on version tags and create a complete release package.

## How the Automated Release Works

### Trigger
The release workflow is triggered automatically when you push a tag that:
- Starts with 'v' (e.g., `v1.0.0`, `v2.1.3`, `v1.0.32`)
- Contains '-v' (e.g., `cspb-admin-v1.0.30`, `enterprise-v2.0.1`)

This covers all existing tag patterns in the repository.

### What Gets Released
The automated release includes:
- All main project files: `index.html`, `index.css`, `index.js`
- Required libraries: `jquery.min.js`, `tailwind.min.css`
- Image assets: `background.png`, `portalLogo_picture@2x.png`, and any other PNG files in the root
- Image assets from the `img/` directory: `cspb-logo.png`, `Edit.png`, `EditActive.png`, `ModalIconClose.png`, `star.png`, `starGrey.png`
- All files are packaged in a ZIP file named `captive-portal-{tag-name}.zip`

### Release Contents
Each release contains:
- **Release Title**: "Captive Portal Release {tag-name}"
- **Release Notes**: Includes version information and commit hash
- **Attachment**: ZIP file with all project files ready for deployment

## How to Create a New Release

### Step 1: Prepare Your Changes
Make sure all your changes are committed and pushed to the main branch:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Step 2: Create and Push a Tag
Create a new version tag following the existing pattern:

```bash
# Check existing tags to see the current version
git tag --list

# Create a new tag (replace with your desired version)
git tag v1.0.32

# Push the tag to trigger the release
git push origin v1.0.32
```

### Step 3: Monitor the Release
1. Go to the **Actions** tab in your GitHub repository
2. You should see a "Create Release" workflow running
3. Once completed, check the **Releases** section to see your new release

## Tag Naming Convention

Based on existing tags in this repository, use the format:
- `v1.0.X` for standard releases (e.g., `v1.0.32`, `v1.0.33`)
- `v1.0-description` for special releases (e.g., `v1.0-public-wifi`)
- `name-v1.0.X` for specific variants (e.g., `cspb-admin-v1.0.30`)

## Examples

### Creating a Standard Release
```bash
# Standard release
git tag v1.0.33
git push origin v1.0.33
```

### Creating a Special Release
```bash
# Special purpose release
git tag v2.0-enterprise
git push origin v2.0-enterprise
```

### Creating an Admin Variant
```bash
# Admin-specific release
git tag cspb-admin-v1.0.34
git push origin cspb-admin-v1.0.34
```

## Troubleshooting

### Release Workflow Doesn't Trigger
- Ensure your tag starts with 'v' or matches the existing pattern
- Check that you pushed the tag: `git push origin <tag-name>`
- Verify the tag was created: `git tag --list`

### Release Creation Fails
- Check the Actions tab for detailed error logs
- Ensure the repository has the necessary permissions for creating releases
- Verify all referenced files exist in the repository

### Missing Files in Release
The workflow copies these specific files:
- `index.html`, `index.css`, `index.js`
- `jquery.min.js`, `tailwind.min.css`
- All PNG files in the root directory (`*.png`)
- `img/` directory (if it exists)

If you add new files that should be included in releases, update the workflow file at `.github/workflows/release.yml`.

## Workflow Configuration

The release workflow is defined in `.github/workflows/release.yml` and:
- Runs on Ubuntu latest
- Has write permissions to repository contents
- Uses the GitHub CLI (`gh`) to create releases
- Automatically generates release notes with version and commit information

For advanced customization, you can modify the workflow file to include additional files or change the release format.