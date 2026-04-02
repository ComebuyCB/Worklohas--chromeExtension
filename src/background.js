// 監聽來自其他組件的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message.from || message.to !== 'background.js' || !message.type) { return true; }

  if (message.type === 'updateReminders') {
    console.log(`${message.from}: updateReminders → @background.js`);
    updateReminders(message.data.reminders);
    sendResponse({ 
      from: 'background.js', 
      to: message.from, 
      type: 'RESPONSE', 
      data: { status: 'success' } 
    });
  }
  return true;
});

// 更新多個提醒設定
function updateReminders(reminders) {
  const enabledCount = reminders.filter(r => r.enabled).length;
  console.log(`BG_ 更新提醒，啟用數量: ${enabledCount}`);
  console.log(`BG_ 收到的提醒設定:`, reminders);
  
  clearAllReminders(() => {
    reminders.forEach((reminder, index) => {
      if (reminder.enabled) {
        console.log(`BG_ 準備建立提醒 ID: ${reminder.id}, 時間: ${reminder.hour}:${reminder.min}, 訊息: ${reminder.message}`);
        setReminder(reminder, reminder.id);
      }
    });
  });
}

// 設定提醒
function setReminder(reminder, id) {
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(parseInt(reminder.hour));
  reminderTime.setMinutes(parseInt(reminder.min));
  reminderTime.setSeconds(0);
  reminderTime.setMilliseconds(0);

  console.log(`BG_ 當前時間: ${now.toLocaleString()}`);
  console.log(`BG_ 提醒時間設定: ${reminderTime.toLocaleString()}`);

  // 如果今天的時間已過，設定為明天
  // 比較時需要考慮秒數，避免邊界情況
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const reminderSeconds = parseInt(reminder.hour) * 3600 + parseInt(reminder.min) * 60;
  
  if (reminderSeconds <= nowSeconds) {
    reminderTime.setDate(reminderTime.getDate() + 1);
    console.log(`BG_ 時間已過，設定為明天: ${reminderTime.toLocaleString()}`);
  }

  let delayInMinutes = (reminderTime - now) / 1000 / 60;
  if (delayInMinutes < 1) {
    delayInMinutes = 1;
  }
  
  const alarmName = `reminder_${id}`;
  const alarmInfo = {
    delayInMinutes: Math.max(1, Math.round(delayInMinutes)),
    periodInMinutes: 24 * 60  // 每24小時重複
  };
  
  console.log(`BG_ 建立鬧鐘: ${alarmName}, 延遲: ${alarmInfo.delayInMinutes} 分鐘, 週期: ${alarmInfo.periodInMinutes} 分鐘`);
  console.log(`BG_ 預計觸發時間: ${new Date(now.getTime() + alarmInfo.delayInMinutes * 60 * 1000).toLocaleString()}`);
  
  chrome.alarms.create(alarmName, alarmInfo, () => {
    if (chrome.runtime.lastError) {
      console.error(`BG_ 創建鬧鐘失敗:`, chrome.runtime.lastError);
    } else {
      console.log(`BG_ 鬧鐘 ${alarmName} 創建成功`);
    }
  });
}

// 清除所有提醒
function clearAllReminders(callback) {
  chrome.alarms.getAll((alarms) => {
    const reminderAlarms = alarms.filter(alarm => alarm.name.startsWith('reminder_'));
    
    if (reminderAlarms.length === 0) {
      if (callback) callback();
      return;
    }
    
    let clearedCount = 0;
    reminderAlarms.forEach((alarm) => {
      chrome.alarms.clear(alarm.name, () => {
        clearedCount++;
        if (clearedCount === reminderAlarms.length && callback) {
          callback();
        }
      });
    });
  });
}

// 監聽提醒觸發
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('reminder_')) {
    const reminderId = alarm.name.replace('reminder_', '');

    chrome.storage.local.get(['reminders'], (result) => {
      if (result.reminders) {
        const reminder = result.reminders.find(r => r.id === reminderId);

        if (reminder) {
          const notificationOptions = {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('static/icons/icon48.png'),
            title: '打卡提醒',
            message: reminder.message || '記得打卡！'
          };

          chrome.notifications.create(`reminder-notification-${reminderId}`, notificationOptions, (notificationId) => {
            if (chrome.runtime.lastError) {
              console.error('BG_ 創建通知失敗:', chrome.runtime.lastError);
            }
          });
        }
      }
    });
  }
});

// 擴充功能啟動時
chrome.runtime.onStartup.addListener(() => {
  initializeReminders();
});

// 擴充功能安裝或更新時
chrome.runtime.onInstalled.addListener(() => {
  initializeReminders();
});

// 初始化提醒
function initializeReminders() {
  chrome.storage.local.get(['reminders'], (result) => {
    if (result.reminders && result.reminders.length > 0) {
      updateReminders(result.reminders);
    }
  });
}
