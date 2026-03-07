---
description: Upload changes to GitHub safely
---
1. Run `git status` to check the current state of the repository.
2. Run `git diff` if there are unstaged changes to review them.
// turbo
3. Run `npm run lint` to confirm no errors exist before uploading.
// turbo
4. Run `git add .` to stage all modifications.
5. Create a well-formatted commit message following conventional commits format. For Example: `git commit -m "feat: [description of features here]"`
6. Run `git push` to upload all changes to the remote repository.
