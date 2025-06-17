$(document).ready(function() {
  let reminders = [
    { id: generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' }
  ];

  // 生成唯一 ID
  function generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }


  // 計算提醒狀態顏色
  function getReminderStatusColor(hour, min, enabled) {
    if (!enabled) return 'transparent';
    
    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(parseInt(hour));
    reminderTime.setMinutes(parseInt(min));
    reminderTime.setSeconds(0);
    reminderTime.setMilliseconds(0);

    // 如果今天的時間已過，設定為明天
    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeDiff = reminderTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff <= 1) {
      return '#dc3545'; // 紅色 - 1小時內
    } else if (hoursDiff <= 4) {
      return '#fd7e14'; // 橘色 - 4小時內
    } else {
      return '#198754'; // 綠色 - 4小時外
    }
  }

  // 生成提醒項目 HTML
  function createReminderItem(index, reminder = { id: generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' }) {
    const timeValue = `${reminder.hour}:${reminder.min}`;
    const triangleColor = getReminderStatusColor(reminder.hour, reminder.min, reminder.enabled);
    
    return `
      <div class="reminder-item card mb-2" data-index="${index}" data-id="${reminder.id}" style="border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div class="card-header d-flex align-items-center py-2 px-3 bg-light position-relative gap-1" style="border-radius: 8px 8px 0 0; border-bottom: 1px solid #e0e0e0;">
          <div class="reminder-triangle" style="position: absolute; top: 0; left: 0; width: 0; height: 0; border-left: 16px solid ${triangleColor}; border-bottom: 16px solid transparent; border-radius: 8px 0 0 0;"></div>
          <input type="text" class="reminder-message form-control form-control-sm border-0 bg-transparent fw-bold" 
                 placeholder="輸入提醒標題" value="${reminder.message}" 
                 style="font-size: 14px; padding: 4px; margin-left: -4px;">
          <button class="btn btn-sm remove-reminder flex-shrink-0" 
                  style="width: 24px; height: 24px; padding: 0; background: none; border: none; font-size: 12px; opacity: 0.6; transition: opacity 0.2s;"
                  onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"><i class="fas fa-trash text-danger"></i>
          </button>
        </div>
        <div class="card-body py-2 px-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <input type="time" class="reminder-time form-control form-control-sm" 
                     value="${timeValue}" style="width: 120px; font-size: 13px;">
            </div>
            <div class="form-check form-switch" style="margin: 0;">
              <input class="form-check-input reminder-enabled ms-0" type="checkbox" ${reminder.enabled ? 'checked' : ''}>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 渲染所有提醒項目
  function renderReminders() {
    const container = $('#remindersContainer');
    container.empty();
    
    reminders.forEach((reminder, index) => {
      container.append(createReminderItem(index, reminder));
    });
    
    // 如果沒有提醒項目，至少顯示一個
    if (reminders.length === 0) {
      reminders.push({ id: generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' });
      container.append(createReminderItem(0, reminders[0]));
    }
  }

  // 載入設定並初始化 UI
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.storage.local.get(['reminders'], (result) => {
      if (result.reminders && result.reminders.length > 0) {
        reminders = result.reminders;
      }
      
      // 渲染提醒項目
      renderReminders();
    });
  });

  // 更新三角形顏色
  function updateTriangleColors() {
    $('.reminder-item').each(function() {
      const $item = $(this);
      const index = parseInt($item.data('index'));
      const reminder = reminders[index];
      if (reminder) {
        const triangleColor = getReminderStatusColor(reminder.hour, reminder.min, reminder.enabled);
        $item.find('.reminder-triangle').css('border-left-color', triangleColor);
      }
    });
  }

  // 自動儲存功能
  function saveReminders(message = '設定已更新') {
    chrome.storage.local.set({ reminders: reminders }, function() {
      chrome.runtime.sendMessage({
        action: 'updateReminders',
        reminders: reminders
      });
      updateTriangleColors();
      showToastMessage(message);
    });
  }

  // 新增提醒按鈕事件
  $(document).on('click', '#addReminder', function() {
    reminders.push({ id: generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' });
    renderReminders();
    saveReminders('新增提醒成功');
  });

  // 刪除提醒按鈕事件
  $(document).on('click', '.remove-reminder', function() {
    if (reminders.length > 1) {
      const id = $(this).closest('.reminder-item').data('id');
      const index = reminders.findIndex(r => r.id === id);
      if (index !== -1) {
        reminders.splice(index, 1);
        renderReminders();
        saveReminders('刪除提醒成功');
      }
    }
  });

  // 啟用狀態變更事件
  $(document).on('change', '.reminder-enabled', function() {
    const reminderItem = $(this).closest('.reminder-item');
    const index = parseInt(reminderItem.data('index'));
    const enabled = $(this).prop('checked');
    
    reminders[index].enabled = enabled;
    saveReminders();
  });

  // 時間選擇變更事件
  $(document).on('change', '.reminder-time', function() {
    const reminderItem = $(this).closest('.reminder-item');
    const index = parseInt(reminderItem.data('index'));
    const timeValue = $(this).val();
    const [hour, min] = timeValue.split(':');
    
    reminders[index].hour = hour;
    reminders[index].min = min;
    saveReminders();
  });

  // 訊息輸入變更事件 - 只在失焦或按Enter時儲存
  $(document).on('blur', '.reminder-message', function() {
    const reminderItem = $(this).closest('.reminder-item');
    const index = parseInt(reminderItem.data('index'));
    const message = $(this).val();
    
    if (reminders[index].message !== message) {
      reminders[index].message = message;
      saveReminders();
    }
  });

  // 訊息輸入按Enter時儲存
  $(document).on('keydown', '.reminder-message', function(e) {
    if (e.key === 'Enter') {
      $(this).blur(); // 觸發 blur 事件來儲存
    }
  });

  // 顯示 Toast 訊息
  function showToastMessage(message = '設定已儲存') {
    $('#toast .toast-body').text(message);
    $('#toast').show();
    setTimeout(() => {
      $('#toast').hide();
    }, 1500);
  }

  // 關閉 Toast
  $('.btn-close').click(function() {
    $('#toast').hide();
  });

  // 每分鐘更新一次三角形顏色
  setInterval(updateTriangleColors, 60000);
});