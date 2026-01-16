# Project Folder Flowchart

```mermaid
graph TD
Root[mernapp] --> backend
Root --> imaages
Root --> public
Root --> src
Root --> gitignore[.gitignore]
Root --> packagejson[package.json]
Root --> packagelock[package-lock.json]
Root --> pk1[pk1.jpeg]
Root --> plain[plain.jpg]
Root --> readme[README.md]
Root --> rtorun[rtorun.txt]

backend --> bindex[index.js]
backend --> bmailer[mailer.js]
backend --> bpackage[package.json]
backend --> bpackagelock[package-lock.json]

imaages --> processed[processsedfood]
imaages --> rawmeat[rawmeat]

processed --> p1[chicken_pickle.jpg]
processed --> p2[salami&sausages.jpg]
processed --> p3[spices_kit.jpg]

rawmeat --> r1[broiler_chicken.jpg]
rawmeat --> r2["chicken breast.jpg"]
rawmeat --> r3[country_eggs.jpg]
rawmeat --> r4[frozen_marinated_chicken.jpg]
rawmeat --> r5[ironprawns.webp]
rawmeat --> r6["King Mackerel.webp"]
rawmeat --> r7[pomfret.jpg]

public --> pfavicon[favicon.ico]
public --> pindex[index.html]
public --> plogo192[logo192.png]
public --> plogo512[logo512.png]
public --> pmanifest[manifest.json]
public --> probots[robots.txt]

src --> sAppcss[App.css]
src --> sAppjs[App.js]
src --> shomecss[home.css]
src --> sindexcss[index.css]
src --> sindexjs[index.js]
src --> sreport[reportWebVitals.js]
src --> components[components]

components --> cAuth[AuthModal.js]
components --> cCart[Cart.js]
components --> cHome[Home.js]
components --> cItems[Items.js]
components --> cLogin[Login.js]
components --> cNavbar[Navbar.js]
