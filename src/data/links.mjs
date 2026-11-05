// Server-side defaults; public responses omit hidden entries.
export const linkSections = [
  {
    "id": "contact",
    "label": "contact"
  },
  {
    "id": "dev",
    "label": "dev"
  },
  {
    "id": "socials",
    "label": "socials"
  },
  {
    "id": "crypto",
    "label": "crypto"
  },
  {
    "id": "media",
    "label": "media"
  },
  {
    "id": "forums",
    "label": "forums"
  },
  {
    "id": "misc",
    "label": "misc"
  },
  {
    "id": "games",
    "label": "games"
  }
];

export const defaultLinks = [
  {
    "id": "contact-matrix",
    "section": "contact",
    "kind": "text",
    "label": "Matrix",
    "value": "@merulox:nitro.chat",
    "visible": true,
    "position": 0,
    "custom": false
  },
  {
    "id": "contact-xmpp",
    "section": "contact",
    "kind": "text",
    "label": "XMPP",
    "value": "merulox@xmpp.jp",
    "visible": true,
    "position": 1,
    "custom": false
  },
  {
    "id": "contact-discord",
    "section": "contact",
    "kind": "text",
    "label": "Discord",
    "value": "@merulox",
    "visible": true,
    "position": 2,
    "custom": false
  },
  {
    "id": "contact-email",
    "section": "contact",
    "kind": "link",
    "label": "email",
    "href": "mailto:web@merulox.com",
    "style": "contact",
    "visible": true,
    "position": 3,
    "custom": false
  },
  {
    "id": "contact-guestbook",
    "section": "contact",
    "kind": "link",
    "label": "guestbook",
    "href": "https://merulox.atabook.org",
    "style": "guestbook",
    "visible": true,
    "position": 4,
    "custom": false
  },
  {
    "id": "dev-github",
    "section": "dev",
    "kind": "link",
    "label": "Github",
    "href": "https://github.com/merulox",
    "visible": true,
    "position": 5,
    "custom": false
  },
  {
    "id": "dev-hugging-face",
    "section": "dev",
    "kind": "link",
    "label": "Hugging Face",
    "href": "https://huggingface.co/merulox",
    "visible": true,
    "position": 6,
    "custom": false
  },
  {
    "id": "dev-codeberg",
    "section": "dev",
    "kind": "link",
    "label": "Codeberg",
    "href": "https://codeberg.org/merulox",
    "dead": true,
    "visible": true,
    "position": 7,
    "custom": false
  },
  {
    "id": "socials-twitter",
    "section": "socials",
    "kind": "link",
    "label": "Twitter",
    "href": "https://twitter.com/merulox",
    "visible": true,
    "position": 8,
    "custom": false
  },
  {
    "id": "socials-substack",
    "section": "socials",
    "kind": "link",
    "label": "Substack",
    "href": "https://substack.com/@merulox",
    "visible": true,
    "position": 9,
    "custom": false
  },
  {
    "id": "socials-guilded",
    "section": "socials",
    "kind": "link",
    "label": "Guilded",
    "href": "https://guilded.gg/u/merulox",
    "dead": true,
    "visible": true,
    "position": 10,
    "custom": false
  },
  {
    "id": "socials-pleroma",
    "section": "socials",
    "kind": "link",
    "label": "Pleroma",
    "href": "https://bae.st/merulox",
    "dead": true,
    "visible": true,
    "position": 11,
    "custom": false
  },
  {
    "id": "crypto-fomo-profile",
    "section": "crypto",
    "kind": "link",
    "label": "Fomo profile",
    "href": "https://fomo.family/profile/merulox",
    "pair": "fomo",
    "visible": true,
    "position": 12,
    "custom": false
  },
  {
    "id": "crypto-fomo-referral",
    "section": "crypto",
    "kind": "link",
    "label": "Fomo referral",
    "href": "https://fomo.family/r/merulox",
    "pair": "fomo",
    "visible": true,
    "position": 13,
    "custom": false
  },
  {
    "id": "crypto-btc",
    "section": "crypto",
    "kind": "address",
    "label": "BTC",
    "value": "bc1qg457y9xrhsmnyzc5k3t9m5zvgdv5phsdtca0gs",
    "visible": true,
    "position": 14,
    "custom": false
  },
  {
    "id": "crypto-sol",
    "section": "crypto",
    "kind": "address",
    "label": "SOL",
    "value": "HrP6ZV3rcR8DfBHMJbuYPpeodKFUi98moV5B76hGTmFH",
    "visible": true,
    "position": 15,
    "custom": false
  },
  {
    "id": "crypto-eth",
    "section": "crypto",
    "kind": "address",
    "label": "ETH",
    "value": "0xA60Bee206f958Fe7bd6bE83f2eC5161805321d87",
    "visible": true,
    "position": 16,
    "custom": false
  },
  {
    "id": "media-lastfm",
    "section": "media",
    "kind": "link",
    "label": "Lastfm",
    "href": "https://www.last.fm/user/merulox",
    "visible": true,
    "position": 17,
    "custom": false
  },
  {
    "id": "media-myanimelist",
    "section": "media",
    "kind": "link",
    "label": "MyAnimeList",
    "href": "https://myanimelist.net/profile/merulox",
    "visible": true,
    "position": 18,
    "custom": false
  },
  {
    "id": "media-anilist",
    "section": "media",
    "kind": "link",
    "label": "Anilist",
    "href": "https://anilist.co/user/Merulox/",
    "visible": true,
    "position": 19,
    "custom": false
  },
  {
    "id": "media-vndb",
    "section": "media",
    "kind": "link",
    "label": "VNDB",
    "href": "https://vndb.org/u182651/ulist?vnlist=1",
    "visible": true,
    "position": 20,
    "custom": false
  },
  {
    "id": "media-goodreads",
    "section": "media",
    "kind": "link",
    "label": "Goodreads",
    "href": "https://www.goodreads.com/user/show/158374147-merulox",
    "visible": true,
    "position": 21,
    "custom": false
  },
  {
    "id": "media-storygraph",
    "section": "media",
    "kind": "link",
    "label": "StoryGraph",
    "href": "https://app.thestorygraph.com/profile/merulox",
    "visible": true,
    "position": 22,
    "custom": false
  },
  {
    "id": "media-letterboxd",
    "section": "media",
    "kind": "link",
    "label": "Letterboxd",
    "href": "https://letterboxd.com/Merulox/",
    "visible": true,
    "position": 23,
    "custom": false
  },
  {
    "id": "media-spotify",
    "section": "media",
    "kind": "link",
    "label": "Spotify",
    "href": "https://open.spotify.com/user/qdjljqisvx98ik2rgvp25lrgh",
    "visible": true,
    "position": 24,
    "custom": false
  },
  {
    "id": "media-bandlab",
    "section": "media",
    "kind": "link",
    "label": "Bandlab",
    "href": "https://www.bandlab.com/merulox",
    "visible": true,
    "position": 25,
    "custom": false
  },
  {
    "id": "media-youtube",
    "section": "media",
    "kind": "link",
    "label": "Youtube",
    "href": "https://youtube.com/@merulox",
    "visible": true,
    "position": 26,
    "custom": false
  },
  {
    "id": "forums-reddit",
    "section": "forums",
    "kind": "link",
    "label": "Reddit",
    "href": "https://reddit.com/u/merulox",
    "visible": true,
    "position": 27,
    "custom": false
  },
  {
    "id": "forums-lemmy",
    "section": "forums",
    "kind": "link",
    "label": "Lemmy",
    "href": "https://lemmy.world/u/merulox",
    "visible": true,
    "position": 28,
    "custom": false
  },
  {
    "id": "forums-sharkey",
    "section": "forums",
    "kind": "link",
    "label": "Sharkey",
    "href": "https://sakurajima.social/@merulox",
    "visible": true,
    "position": 29,
    "custom": false
  },
  {
    "id": "forums-mangadex",
    "section": "forums",
    "kind": "link",
    "label": "MangaDex",
    "href": "https://forums.mangadex.org/members/merulox.622459/",
    "visible": true,
    "position": 30,
    "custom": false
  },
  {
    "id": "forums-0x00sec",
    "section": "forums",
    "kind": "link",
    "label": "0x00sec",
    "href": "https://forum.0x00sec.org/u/merulox/summary",
    "visible": true,
    "position": 31,
    "custom": false
  },
  {
    "id": "forums-lesswrong",
    "section": "forums",
    "kind": "link",
    "label": "LessWrong",
    "href": "https://www.lesswrong.com/users/merulox",
    "visible": true,
    "position": 32,
    "custom": false
  },
  {
    "id": "forums-robloxforum",
    "section": "forums",
    "kind": "link",
    "label": "RobloxForum",
    "href": "https://www.robloxforum.com/members/43998/",
    "dead": true,
    "visible": true,
    "position": 33,
    "custom": false
  },
  {
    "id": "misc-tryhackme",
    "section": "misc",
    "kind": "link",
    "label": "TryHackMe",
    "href": "https://tryhackme.com/p/merulox",
    "visible": true,
    "position": 34,
    "custom": false
  },
  {
    "id": "misc-yggdrasil-radio",
    "section": "misc",
    "kind": "link",
    "label": "Yggdrasil Radio",
    "href": "https://yggdrasilradio.com/#/user/merulox/2644",
    "visible": true,
    "position": 35,
    "custom": false
  },
  {
    "id": "games-monkeytype",
    "section": "games",
    "kind": "link",
    "label": "Monkeytype",
    "href": "https://monkeytype.com/profile/Merulox",
    "visible": true,
    "position": 36,
    "custom": false
  },
  {
    "id": "games-steam",
    "section": "games",
    "kind": "link",
    "label": "Steam",
    "href": "https://steamcommunity.com/id/merulox",
    "visible": true,
    "position": 37,
    "custom": false
  },
  {
    "id": "games-roblox",
    "section": "games",
    "kind": "link",
    "label": "Roblox",
    "href": "https://www.roblox.com/users/67556906/profile",
    "visible": true,
    "position": 38,
    "custom": false
  },
  {
    "id": "games-osu",
    "section": "games",
    "kind": "link",
    "label": "osu!",
    "href": "https://osu.ppy.sh/users/17362768",
    "visible": true,
    "position": 39,
    "custom": false
  },
  {
    "id": "games-chess-com",
    "section": "games",
    "kind": "link",
    "label": "Chess.com",
    "href": "https://www.chess.com/member/merulox",
    "visible": true,
    "position": 40,
    "custom": false
  }
];
