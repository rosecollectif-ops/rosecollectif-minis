ROSECOLLECTIF MINIS - HOME SETUP GUIDE

WHAT IS ALREADY BUILT
- Homepage
- Scrolling album-name banner
- Clickable gallery/albums
- Commissions page
- Contact page
- Social links
- Mobile-friendly layout
- 18 album names from your existing Wix galleries
- No illustration work
- No album photos yet, as requested

STEP 1 - PREVIEW IT ON YOUR COMPUTER
1. Unzip the folder.
2. Double-click index.html.
3. It will open in your browser.
4. Click around the pages and albums.

STEP 2 - CREATE YOUR FREE GITHUB ACCOUNT
1. Go to github.com and create/sign in to an account.
2. Create a new repository called: rosecollectif-minis
3. Set it to Public.
4. Upload ALL the files and folders from this package.
5. Commit the files.

STEP 3 - TURN ON FREE GITHUB PAGES
1. In the repository, open Settings.
2. Choose Pages.
3. Under Build and deployment choose "Deploy from a branch".
4. Branch: main
5. Folder: /(root)
6. Save.
7. GitHub will give you a free web address.

STEP 4 - CHANGE COLOURS / BACKGROUND / WORDING
Open site-data.js in GitHub and click the pencil/Edit button.

The important section is:
appearance: {
  background: '#f4f1ec',
  text: '#202020',
  accent: '#8d6f5a',
  card: '#ffffff',
  heroImage: ''
}

You can replace any hex colour.
For a homepage background image, put an image URL between the quotes for heroImage.

STEP 5 - SOCIAL LINKS
In site-data.js find "socials" and replace the links with yours.
Instagram is already set to rosecollectifminis based on your current branding. Check/correct it before publishing.

STEP 6 - GOOGLE DRIVE ALBUM FOLDERS
Create one Google Drive folder for each album.
Suggested master folder: RoseCollectif Minis Website
Then create one folder per album name.

For each folder:
1. Right-click folder > Share.
2. Change General access to "Anyone with the link" > Viewer.
3. Copy the folder link.
4. In site-data.js find the matching album.
5. Paste the link into driveFolder:''
Example:
{title:'Warhound Titan', category:'Adeptus Titanicus', driveFolder:'PASTE LINK HERE'}

IMPORTANT: in this first prototype, clicking the album shows that its Drive folder is connected and offers a link to it. It does NOT yet automatically display every Drive image inside the website. That automatic feed requires a small Google API/Apps Script connector. Do the GitHub/Drive setup first, then that connector can be added without rebuilding the site.

STEP 7 - CONTACT FORM (FREE)
This static website needs a form-handling service.
Easiest free route:
1. Create a free Formspree account at formspree.io.
2. Create a form.
3. Copy its endpoint URL.
4. Open site-data.js.
5. Paste it here:
formspreeEndpoint: 'YOUR ENDPOINT HERE'
6. Save/commit.
The contact form will then email submissions to you.

STEP 8 - YOUR OWN DOMAIN
Do NOT buy a hosting package.
Buy only the domain from a registrar you like.
Then in GitHub:
1. Repository > Settings > Pages.
2. Find Custom domain.
3. Enter your domain.
4. GitHub will tell you the DNS records to add at your domain registrar.
5. Add those records at the registrar.
6. When verified, enable Enforce HTTPS.

STEP 9 - ADD A NEW ALBUM LATER
Open site-data.js and add another line inside albums:
{title:'Album Name', category:'Warhammer', driveFolder:''},
The gallery card appears automatically.

STEP 10 - CHANGE THE SCROLLING BANNER
The banner currently automatically uses every album name. Add/remove/reorder albums in site-data.js and the scrolling banner updates automatically.

NOTE ABOUT PHOTOS
This version intentionally contains no photos. That keeps it tiny, quick to upload, and lets Google Drive become your photo-management workflow later.
