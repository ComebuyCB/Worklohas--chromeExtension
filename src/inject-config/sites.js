const inject_sites = {
  "cloud.nueip.com": [
    {
      "name": "NUEIP",
      "inject": {
        "scripts": ["src/inject/cloud.nueip.com/attendance_record.js"],
        "styles": ["src/inject/cloud.nueip.com/attendance_record.css"]
      },
      "urlPatterns": ["/attendance_record"],
      "initMessage": "INIT_SELECT_VALUES",
      "description": "NUEIP 自動打卡功能"
    },
    {
      "name": "NUEIP",
      "inject": {
        "scripts": ["src/inject/cloud.nueip.com/login.js"],
        "styles": ["src/inject/cloud.nueip.com/login.css"]
      },
      "urlPatterns": ["/login"],
      "initMessage": "INIT_LOGIN",
      "description": "NUEIP 登入頁面功能"
    }
  ],
  "www.youtube.com": [
    {
      "name": "YOUTUBE",
      "inject": {
        "scripts": ["src/inject/www.youtube.com/watch.js"],
        "styles": ["src/inject/www.youtube.com/watch.css"]
      },
      "urlPatterns": ["/watch"],
      "initMessage": "INIT_YOUTUBE_WATCH",
      "description": "YouTube 觀看頁面功能增強"
    }
  ],
  "rent.591.com.tw": [
    {
      "name": "RENT591",
      "inject": {
        "scripts": ["src/inject/rent.591.com.tw/list.js"],
        "styles": ["src/inject/rent.591.com.tw/list.css"]
      },
      "urlPatterns": ["/list"],
      "initMessage": "INIT_RENT_LIST",
      "description": "591租屋網列表頁面功能增強"
    }
  ]
}

var SITE_CONFIGS = inject_sites;