# Push this source to your GitHub

Extract the ZIP. Open the Aditya-Portfolio folder in VS Code, then open Git Bash in that folder.

Create an empty GitHub repository named `aditya-portfolio` under your account. Do not initialize it with a README or .gitignore, because these are included here. Then run:

```bash
git init -b main
git add .
git commit -m "Add developer portfolio"
git remote add origin https://github.com/adithyadiwanad-sudo/aditya-portfolio.git
git push -u origin main
```

If asked, sign in through Git's browser authentication flow. Do not paste passwords or tokens into chat.

For later updates:

```bash
git add .
git commit -m "Update portfolio"
git push
```

The portfolio is publicly hosted at https://aditya-diwanad-portfolio.smart-toad-4328.chatgpt.site . Put that URL in the repository About section.

GitHub stores this source. Pushing a commit alone does not update the existing hosted site. Ask to deploy source changes separately. Changes made through the online project editor are already saved in the hosted storage and are not part of Git history.

The backend requires Cloudflare R2 and trusted Sites identity headers. GitHub Pages alone cannot run the project editor. The included hosting manifest specifies the logical storage binding without carrying the original Site identity or credentials.
