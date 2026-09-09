# Aditya Diwanad — Portfolio

Dark emerald developer portfolio with a portrait, project gallery, resume links, and an owner-only project editor.

## Add a project without editing code

1. Open the portfolio and choose **Manage projects** in the footer.
2. Sign in with the portfolio owner's ChatGPT account when prompted.
3. Choose **Add project** and enter the title, description, technologies, and highlights.
4. Upload a PNG, JPEG, or WebP screenshot under 4 MB.
5. Add a GitHub URL and, when available, a separately hosted live demo URL.
6. Keep visibility on **Draft** while preparing it. Choose **Show on portfolio** when ready, then save.

Use the same editor to update existing projects or switch their visibility back to Draft. Draft screenshots and project details are not served to anonymous visitors. Saving project content does not change the whole site's private/public access.

This editor uploads screenshots and project descriptions, not complete application source folders. Host each working application separately and add its demo link here.

## Edit the design in VS Code

| File | Purpose |
| --- | --- |
| `public/index.html` | Introduction, about, skills, contact links |
| `public/style.css` | Layout, typography, colors, and mobile styles |
| `public/assets/aditya.jpg` | Portrait |
| `public/assets/Aditya-Diwanad-Resume.pdf` | Downloadable resume |
| `public/admin.html`, `admin.css`, `admin.js` | Project editor |
| `worker/projects.mjs` | Initial project records and project-card layout |
| `worker/index.mjs` | Authorization, saved projects, screenshot uploads |
| `scripts/build.mjs` | Generates the deployable Worker |

Replace the resume or photo while keeping the filenames to update them. Site theme overrides are labeled DARK EMERALD DIRECTION in style.css.

## Build and checks

This code has no third-party npm dependencies. With Node.js installed:

```bash
npm run build
npm test
```

Opening `public/index.html` directly previews the design and original project cards. The owner editor requires the deployed backend and platform sign-in; it does not save data when opened as a local file.

Compiled output is generated in `dist/server/index.js`. Do not edit it directly. Rebuild and deploy after changing source files. Changes saved in the online project editor persist separately and survive redeployment.

## Storage and access

The deployment uses a Cloudflare R2 binding called BUCKET. The small project catalog and uploaded screenshots are saved there. It uses the Sites gateway's authenticated user headers, with a server-side owner allowlist, and requires matching Origin for writes. Do not deploy the Worker on a host that lets visitors spoof those identity headers. Private site access stays controlled by Sites.

The editor supports up to 40 projects. Conditional saves prevent overwriting concurrent changes. Failed saves keep the form intact. Uploaded images removed from a project become inaccessible to anonymous visitors; they are retained in storage rather than permanently deleted.

The downloadable resume was included unchanged. Its branch differs from earlier context, so the page uses Bachelor of Engineering until the owner confirms the exact branch.

## References

Visual direction: the Instagram reel supplied by the owner, https://www.instagram.com/reel/DQmwUUwk0Ff/ . The implementation is original.
Storage API: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
