$(document).ready(function() {
  const reminderSettings = {
    enabled: false,
    hour: '09',
    min: '00',
    message: '記得打卡！'
  };

  // 生成小時選項 (00-23)
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const hourSelect = $('#reminderHour');
  hours.forEach(hour => {
    hourSelect.append(`<option value="${hour}">${hour}</option>`);
  });

  // 生成分鐘選項 (00-59)
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const minSelect = $('#reminderMin');
  minutes.forEach(min => {
    minSelect.append(`<option value="${min}">${min}</option>`);
  });

  // 檢查是否在目標頁面
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.storage.local.get(['reminderSettings'], (result) => {
      console.log('POP_ Loaded settings:', result.reminderSettings);
      if (result.reminderSettings) {
        reminderSettings.enabled = result.reminderSettings.enabled;
        reminderSettings.hour = result.reminderSettings.hour;
        reminderSettings.min = result.reminderSettings.min;
        reminderSettings.message = result.reminderSettings.message;

        // 更新 UI
        $('#reminderSwitch').prop('checked', reminderSettings.enabled);
        $('#reminderHour').val(reminderSettings.hour);
        $('#reminderMin').val(reminderSettings.min);
        $('#reminderMessage').val(reminderSettings.message);
        $('#reminderSettings').toggle(reminderSettings.enabled);
      }
    });
  });

  // 開關切換事件
  $('#reminderSwitch').change(function() {
    console.log('POP_ Switch changed:', $(this).prop('checked'));
    reminderSettings.enabled = $(this).prop('checked');
    $('#reminderSettings').toggle(reminderSettings.enabled);
  });

  // 儲存設定
  $('#saveReminder').click(function() {
    console.log('POP_ Save button clicked');
    reminderSettings.hour = $('#reminderHour').val();
    reminderSettings.min = $('#reminderMin').val();
    reminderSettings.message = $('#reminderMessage').val();
    console.log('POP_ New settings:', reminderSettings);

    chrome.storage.local.set({ reminderSettings: reminderSettings }, function() {
      // 通知 background.js 更新提醒設定
      chrome.runtime.sendMessage({
        action: 'updateReminder',
        settings: reminderSettings
      }, function(response) {
        console.log('POP_ Message sent to background, response:', response);
      });
      showToastMessage();
    });
  });

  // 顯示 Toast 訊息
  function showToastMessage() {
    $('#toast').show();
    setTimeout(() => {
      $('#toast').hide();
    }, 1000);
  }

  // 關閉 Toast
  $('.btn-close').click(function() {
    $('#toast').hide();
  });
});