/**
 * 網站配置
 *
 * paths[].url 匹配規則:
 * - "example.com/page"      精確匹配 hostname + path
 * - "example.com/blog*"     前綴匹配，結尾 * 匹配 /blog、/blog/post-1 等
 * - "example.com/"          精確匹配 hostname 且僅限根路徑 "/"，不匹配其他子路徑
 * - "example.com"           僅匹配 hostname，不限制路徑（比對所有路徑）
 * - "*.example.com/*"       萬用字元主機，匹配所有子網域的所有路徑
 * - "*.example.com/admin*"  萬用字元主機 + 前綴路徑匹配
 *
 * 最外層 key 為識別名稱，僅作為 toggleKey 預設值，不參與 URL 比對。
 * toggleKey: 多個 entry 共用同一開關時設定相同值（預設使用 key）
 *
 * info.title:       toggleInject 顯示的功能名稱
 * info.description: toggleInject 顯示的說明文字
 * info.group:       toggleInject 分組標籤，無值時不分組
 * info.quickLink:   toggleInject 顯示的連結，無值時不顯示連結
 * info.favicon:     toggleInject 顯示的圖示，無值時 fallback 抓 primaryHost 的 favicon.ico
 *
 * paths[].features: 識別到以下字串就啟用對應行為，為陣列，沒有可以不寫
 * - "spa":    content.js 會針對該路徑掛 SPA URL 變化監聽
 * - "jquery": 該路徑額外注入 jQuery（提供 window.$ / window.jQuery），
 *             僅限確認過該網站沒有自己的 $ 衝突時才開啟
 *
 * paths[].init(send):      注入腳本載入後，content.js 呼叫此 function 取得初始資料再送 INIT
 * paths[].onMessage[type]: inject 腳本送來特定 type 時，由此處理（取代 content.js 的寫死邏輯）
 */
const inject_sites = {
  "nueip": {
    "info": {
      "title": "NUEIP 快速打卡",
      "description": "NUEIP 快速打卡功能",
      "group": "",
      "favicon": "https://cloud.nueip.com/favicon.ico",
      "quickLink": "https://cloud.nueip.com/attendance_record"
    },
    "paths": [
      {
        "url": "cloud.nueip.com/attendance_record",
        init: (send) => {
          chrome.storage.local.get(['nueip_punch_settings'], send);
        },
        onMessage: {
          'SAVE_SELECT_VALUES': (data) => {
            chrome.storage.local.set({ nueip_punch_settings: data.nueip_punch_settings });
          }
        },
        "inject": {
          "css": ["src/inject/nueip.com/attendance_record.css"],
          "js": ["src/inject/nueip.com/attendance_record.js"]
        }
      },
      {
        "url": "portal.nueip.com/login",
        "inject": {
          "css": ["src/inject/nueip.com/login.css"],
          "js": ["src/inject/nueip.com/login.js"]
        }
      }
    ]
  },
  "worklohas-portal": {
    "info": {
      "title": "Worklohas Portal",
      "description": "Zoho 詳細視窗化樣式",
      "group": "",
      "favicon": "https://static.zohocdn.com/projects/images/faviconIndication_0d933_.ico",
      "quickLink": "https://projects.worklohas.com/portal/worklohas"
    },
    "paths": [
      {
        "url": "projects.worklohas.com/portal/worklohas",
        init: (send) => {
          chrome.storage.local.get(['wl_portal_settings'], send);
        },
        onMessage: {
          'SAVE_PORTAL_SETTINGS': (data) => {
            chrome.storage.local.set({ wl_portal_settings: data.wl_portal_settings });
          }
        },
        "inject": {
          "css": ["src/inject/projects.worklohas.com/portal/worklohas.css"],
          "js": ["src/inject/projects.worklohas.com/portal/worklohas.js"]
        }
      }
    ]
  },
  "worklohas-pm": {
    "info": {
      "title": "Worklohas 測試站",
      "description": "帳密管理 (worklohas.com / worklohas.dev)",
      "group": ""
    },
    "paths": [
      {
        "url": "*.worklohas.com/*",
        "inject": {
          "css": ["src/inject/worklohas.com/index.css"],
          "js": ["src/inject/worklohas.com/index.js"]
        }
      },
      {
        "url": "*.worklohas.dev/*",
        "inject": {
          "css": ["src/inject/worklohas.com/index.css"],
          "js": ["src/inject/worklohas.com/index.js"]
        }
      }
    ]
  },
  "591": {
    "info": {
      "title": "591 房屋網",
      "description": "591 租屋網 / 買屋網表格化",
      "group": "其他",
      "quickLink": "https://rent.591.com.tw/list"
    },
    "paths": [
      {
        "url": "rent.591.com.tw/list",
        "features": ["spa", "jquery"],
        "inject": {
          "css": ["src/inject/591.com.tw/rent.css"],
          "js": ["src/inject/591.com.tw/rent.js"]
        }
      },
      {
        "url": "sale.591.com.tw/",
        "features": ["spa", "jquery"],
        "inject": {
          "css": ["src/inject/591.com.tw/sale.css"],
          "js": ["src/inject/591.com.tw/sale.js"]
        }
      }
    ]
  }
}

var SITE_CONFIGS = inject_sites;
