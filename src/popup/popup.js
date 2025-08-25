$(document).ready(() => {
  window.reminderManager = new ReminderManager();
  
  // 綁定複製按鈕事件
  $('button[data-copy]').on('click', function() {
    const textToCopy = $(this).data('copy');
    copyContext(textToCopy);
  });
});

async function copyContext(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast('已複製!');
    } else {
      // 備用方案：創建隱藏的 textarea 元素
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      if (document.execCommand('copy')) {
        showToast('已複製!');
      } else {
        showToast('複製失敗');
      }
      document.body.removeChild(textArea);
    }
  } catch (err) {
    console.error('複製失敗:', err);
    showToast('複製失敗');
  }
}

function showToast(message = '設定已儲存') {
  $('#toast .toast-body').text(message);
  $('#toast').show();
  setTimeout(() => {
    $('#toast').hide();
  }, 1500);
}

class ReminderManager {
  constructor() {
    this.reminders = [
      { id: this.generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' }
    ];
    this.updateColorInterval = null;
    this.init();
  }

  async init() {
    await this.loadReminders();
    this.bindEvents();
    this.startColorUpdateInterval();
  }

  generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getReminderStatusColor(hour, min, enabled) {
    if (!enabled) return 'transparent';

    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(parseInt(hour));
    reminderTime.setMinutes(parseInt(min));
    reminderTime.setSeconds(0);
    reminderTime.setMilliseconds(0);

    if (reminderTime <= now) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }

    const timeDiff = reminderTime - now;
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff <= 1) {
      return '#dc3545'; 
    } else if (hoursDiff <= 4) {
      return '#fd7e14';
    } else {
      return '#198754';
    }
  }

  createReminderItem(index, reminder = { id: this.generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' }) {
    const timeValue = `${reminder.hour}:${reminder.min}`;
    const triangleColor = this.getReminderStatusColor(reminder.hour, reminder.min, reminder.enabled);

    return `
      <div class="reminder-item card mb-2 shadow-sm" data-index="${index}" data-id="${reminder.id}">
        <div class="card-header d-flex align-items-center py-2 px-3 bg-light position-relative gap-1 overflow-hidden">
          <div class="reminder-triangle" style="border-left: 16px solid ${triangleColor};"></div>
          <input type="text" class="reminder-message form-control form-control-sm border-0 bg-transparent fw-bold"  placeholder="輸入提醒標題" value="${reminder.message}">
          <button class="btn-remove remove-reminder flex-shrink-0" type="button">
            <i class="fas fa-trash text-danger"></i>
          </button>
        </div>
        <div class="card-body py-2 px-3">
          <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-2">
              <input type="time" class="reminder-time form-control form-control-sm" value="${timeValue}" style="width: 120px;">
            </div>
            <div class="form-check form-switch m-0">
              <input class="form-check-input reminder-enabled ms-0" type="checkbox" ${reminder.enabled ? 'checked' : ''}>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderReminders() {
    const container = $('#remindersContainer');
    container.empty();
    
    this.reminders.forEach((reminder, index) => {
      container.append(this.createReminderItem(index, reminder));
    });
    
    if (this.reminders.length === 0) {
      this.reminders.push({ id: this.generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' });
      container.append(this.createReminderItem(0, this.reminders[0]));
    }
  }

  loadReminders() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, () => {
        chrome.storage.local.get(['reminders'], (result) => {
          if (result.reminders && result.reminders.length > 0) {
            this.reminders = result.reminders;
          }
          this.renderReminders();
          resolve();
        });
      });
    });
  }

  updateTriangleColors() {
    $('.reminder-item').each((index, element) => {
      const $item = $(element);
      const dataIndex = parseInt($item.data('index'));
      const reminder = this.reminders[dataIndex];
      if (reminder) {
        const triangleColor = this.getReminderStatusColor(reminder.hour, reminder.min, reminder.enabled);
        $item.find('.reminder-triangle').css('border-left-color', triangleColor);
      }
    });
  }

  saveReminders(message = '設定已更新') {
    chrome.storage.local.set({ reminders: this.reminders }, () => {
      chrome.runtime.sendMessage({
        from: 'popup.js',
        to: 'background.js',
        type: 'updateReminders',
        data: {
          reminders: this.reminders
        }
      });
      this.updateTriangleColors();
      showToast(message);
    });
  }

  addReminder() {
    this.reminders.push({ id: this.generateId(), enabled: false, hour: '09', min: '00', message: '記得打卡！' });
    this.renderReminders();
    this.saveReminders('新增提醒成功');
  }

  removeReminder(id) {
    if (this.reminders.length > 1) {
      const index = this.reminders.findIndex(r => r.id === id);
      if (index !== -1) {
        this.reminders.splice(index, 1);
        this.renderReminders();
        this.saveReminders('刪除提醒成功');
      }
    }
  }


  bindEvents() {
    $(document).on('click', '#addReminder', () => {
      this.addReminder();
    });

    $(document).on('click', '.remove-reminder', (e) => {
      const id = $(e.currentTarget).closest('.reminder-item').data('id');
      this.removeReminder(id);
    });

    $(document).on('change', '.reminder-enabled', (e) => {
      const index = parseInt($(e.currentTarget).closest('.reminder-item').data('index'));
      if (this.reminders[index]) {
        this.reminders[index].enabled = $(e.currentTarget).prop('checked');
        this.saveReminders();
      }
    });

    $(document).on('change', '.reminder-time', (e) => {
      const index = parseInt($(e.currentTarget).closest('.reminder-item').data('index'));
      const [hour, min] = $(e.currentTarget).val().split(':');
      if (this.reminders[index]) {
        this.reminders[index].hour = hour;
        this.reminders[index].min = min;
        this.saveReminders();
      }
    });

    $(document).on('blur', '.reminder-message', (e) => {
      const index = parseInt($(e.currentTarget).closest('.reminder-item').data('index'));
      const message = $(e.currentTarget).val();
      if (this.reminders[index] && this.reminders[index].message !== message) {
        this.reminders[index].message = message;
        this.saveReminders();
      }
    });

    $(document).on('keydown', '.reminder-message', (e) => {
      if (e.key === 'Enter') {
        $(e.currentTarget).blur();
      }
    });

    $('.btn-close').click(() => {
      $('#toast').hide();
    });
  }

  startColorUpdateInterval() {
    if (this.updateColorInterval) {
      clearInterval(this.updateColorInterval);
    }
    this.updateColorInterval = setInterval(() => {
      this.updateTriangleColors();
    }, 60000);
  }

  stopColorUpdateInterval() {
    if (this.updateColorInterval) {
      clearInterval(this.updateColorInterval);
      this.updateColorInterval = null;
    }
  }

  destroy() {
    this.stopColorUpdateInterval();
    $(document).off('.reminderManager');
  }
}