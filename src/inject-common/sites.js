/**
 * 網站配置
 *
 * URL 匹配規則:
 * - 沒有 * : 精確匹配 (例: "example.com/page" 只匹配 /page)
 * - 有 * 結尾: 前綴匹配 (例: "example.com/blog*" 匹配 /blog, /blog/post-1, /blog/post-2 等)
 */
const inject_sites = {
  "cloud.nueip.com": {
    "description": "NUEIP 自動打卡功能",
    "paths": [
      {
        "url": "cloud.nueip.com/attendance_record",
        "inject": {
          "css": ["src/inject/cloud.nueip.com/attendance_record.css"],
          "js": ["src/inject/cloud.nueip.com/attendance_record.js"]
        }
      },
      {
        "url": "cloud.nueip.com/login",
        "inject": {
          "css": ["src/inject/cloud.nueip.com/login.css"],
          "js": ["src/inject/cloud.nueip.com/login.js"]
        }
      }
    ]
  },
  "www.youtube.com": {
    "description": "YouTube 跳廣告",
    "paths": [
      {
        "url": "www.youtube.com/watch",
        "inject": {
          "css": ["src/inject/www.youtube.com/watch.css"],
          "js": ["src/inject/www.youtube.com/watch.js"]
        }
      }
    ]
  },
  "rent.591.com.tw": {
    "description": "591 租屋網表格化",
    "paths": [
      {
        "url": "rent.591.com.tw/list",
        "inject": {
          "css": ["src/inject/rent.591.com.tw/list.css"],
          "js": ["src/inject/rent.591.com.tw/list.js"]
        }
      }
    ]
  },
  "projects.worklohas.com": {
    "description": "Zoho 詳細視窗樣式",
    "favicon": "https://static.zohocdn.com/projects/images/faviconIndication_0d933_.ico",
    "paths": [
      {
        "url": "projects.worklohas.com/portal/worklohas",
        "inject": {
          "css": ["src/inject/projects.worklohas.com/portal/worklohas.css"],
          "js": ["src/inject/projects.worklohas.com/portal/worklohas.js"]
        }
      }
    ]
  }
}

var SITE_CONFIGS = inject_sites;
