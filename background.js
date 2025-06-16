console.log('BG_ Background script loaded');

// 監聽來自 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('BG_ Received message:', message);
  if (message.action === 'updateReminder') {
    console.log('BG_ Updating reminder with settings:', message.settings);
    updateReminder(message.settings);
    sendResponse({ status: 'success' });
  }
  return true; // 保持訊息通道開啟
});

// 更新提醒設定
function updateReminder(settings) {
  console.log('BG_ updateReminder called with:', settings);
  if (settings.enabled) {
    setReminder(settings);
  } else {
    clearReminder();
  }
}

// 設定提醒
function setReminder(settings) {
  console.log('BG_ setReminder called with:', settings);
  clearReminder();

  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(parseInt(settings.hour));
  reminderTime.setMinutes(parseInt(settings.min));
  reminderTime.setSeconds(0);
  reminderTime.setMilliseconds(0);

  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }

  const delayInMinutes = (reminderTime - now) / 1000 / 60;
  console.log('BG_ Setting alarm for:', reminderTime, 'delay in minutes:', delayInMinutes);

  chrome.alarms.create('reminder', {
    delayInMinutes: delayInMinutes,
    periodInMinutes: 24 * 60
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('BG_ Error creating alarm:', chrome.runtime.lastError);
    } else {
      console.log('BG_ Alarm created successfully');
    }
  });
}

// 清除提醒
function clearReminder() {
  console.log('BG_ Clearing reminder');
  chrome.alarms.clear('reminder', (wasCleared) => {
    console.log('BG_ Reminder cleared:', wasCleared);
  });
}

// 監聽提醒觸發
chrome.alarms.onAlarm.addListener((alarm) => {
  console.log('BG_ Alarm triggered:', alarm);
  if (alarm.name === 'reminder') {
    chrome.storage.local.get(['reminderSettings'], (result) => {
      console.log('BG_ Got settings for notification:', result.reminderSettings);
      if (result.reminderSettings) {
        const notificationOptions = {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('static/icons/icon128.png'),
          title: '打卡提醒',
          message: result.reminderSettings.message
        };
        console.log('BG_ Creating notification with options:', notificationOptions);

        chrome.notifications.create('reminder-notification', notificationOptions, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('BG_ Error creating notification:', chrome.runtime.lastError);
          } else {
            console.log('BG_ Notification created successfully:', notificationId);
          }
        });
      }
    });
  }
});
