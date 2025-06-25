const inject_sites = {
  "cloud.nueip.com": {
    "name": "NUEIP",
    "inject": {
      "scripts": ["src/inject/nueip/nueip-inject.js"],
      "styles": ["src/inject/nueip/nueip-inject.css"]
    },
    "urlPatterns": ["/attendance_record"],
    "initMessage": "INIT_SELECT_VALUES",
    "description": "NUEIP 自動打卡功能"
  },
  "www.youtube.com": {
    "name": "YOUTUBE",
    "inject": {
      "scripts": ["static/jquery-3.5.1/jquery.min.js", "src/inject/youtube/youtube-inject.js"],
      "styles": ["src/inject/youtube/youtube-inject.css"]
    },
    "urlPatterns": ["/watch"],
    "initMessage": "INIT_YOUTUBE",
    "description": "YouTube 功能增強"
  }
}

var SITE_CONFIGS = inject_sites;