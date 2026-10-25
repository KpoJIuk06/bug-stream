`extension/scripts/pack-extension.ps1` puts `adtask.crx` and `update.xml` here.
The site serves them at `https://<domain>/extension/update.xml` and `.../adtask.crx` — Chrome installs and updates the extension from there by group policy.
The files are build output and never go to git.
