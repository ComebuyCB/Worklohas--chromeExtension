$(function(){
  $('body').append(`
    <div id="CB_fixed" style="position: fixed; bottom: 0; left: 0; z-index: 9999;">
      <button id="CB_btn" class="btn btn-danger btn-sm" style="margin-bottom: 0 !important;">
        <i class="fa fa-plus"></i> 自動補卡
      </button>
    </div>
  `);
  })

  $(document).on('click', '#CB_btn', ()=>{
    CB_autoCheckIn();
  })

  function CB_autoCheckIn(){
    const date_today = new Date().toISOString().split('T')[0];
    const $TR = $('#body-wrapper #table_content').children('tbody').children('tr');
    const U_SN = $TR.children('td').eq(0).attr('class').split(' ').find((val)=>(/sn\d\d\d\d\d\d/g).test(val))?.replace('sn',''); // 尋找 u_sn
    const STATIC_startTime = '10:00:00';
    const STATIC_endTime = '19:00:00';

    let hasAjax = false;
    let ajaxArray = [];

    $.each( $TR, function(trIdx, trVal){
      /*=== 檢查日期，未來或休假 ===*/
      let TR_hasBG = $(trVal).attr('class').split(' ').some((val)=> (/bg_color/g).test(val) ); // <tr> 是否存在.bg_color (代表是"假日或特休")。
      let TR_date = $.trim( $(trVal).children('td[data-th="日期"]').find('.dateday')?.text() ); // <tr> 日期文字 "HH:mm:ss"。
      if ( date_today < TR_date || TR_hasBG === true ){ // 未來或休假，continue;
        console.log(TR_date, '未來或休假');
        return true;
      }

      /*=== 時間打卡，上班和下班 ===*/
      let startTime = $.trim( $(trVal).children('td[data-th="上班"]')?.text() );
      let endTime = $.trim( $(trVal).children('td[data-th="下班"]')?.text() );
      if ( startTime.length === 0 ){ // 補卡 (上班)
        let endTime_new = (endTime.length > 0) ? endTime : STATIC_endTime;
        let {hour, min} = cb_getRdHourMin(endTime_new, -9, 25);
        let postData = {
          section: 1,
          hour,
          min,
          remark: '補卡',
          u_sn: U_SN,
          date: TR_date,
          apply_date: TR_date,
        }

        hasAjax = true;
        console.log('ajax 補卡(上班) !!!!!', postData);
        ajaxArray.push( CB_PromiseAjax( postData ) );
      }
      if ( endTime.length === 0 ){ // 補卡 (下班)
        let startTime_new = (startTime.length > 0) ? startTime : STATIC_startTime;
        let {hour, min} = cb_getRdHourMin(startTime_new, +9, 25);
        let postData = {
          section: 2,
          hour,
          min,
          remark: '補卡',
          u_sn: U_SN,
          date: TR_date,
          apply_date: TR_date,
        }

        hasAjax = true;
        console.log('ajax 補卡(下班) !!!!!', postData);
        ajaxArray.push( CB_PromiseAjax( postData ) );
      }

      /*
        * @desc 範例: fn("10:00:00", 9, 15) => 回傳範圍: "18:45:00"~"19:15:00"。
        * @param {string} time "HH:mm:ss";
        * @param {number} addHour 正負小時;
        * @param {number} rangeMins 分鐘區間;
        * @return {object} {hour: '', min: ''};
      */
      function cb_getRdHourMin(time, addHours, rangeMins){
        let rd_min = Math.floor((Math.random() * (rangeMins * 2 + 1)) - rangeMins);
        let rd_time = moment(time, "HH:mm:ss").add({hours: addHours, minutes: rd_min, seconds: 0}).format("HH:mm:ss").split(':');
        return {hour: rd_time[0], min: rd_time[1],}
      }
    })

    function CB_PromiseAjax(data){
      /*
        data: {
          section, // 上班:1 / 下班:2,
          u_sn, // userSn
          date, // 日期
          apply_date, // 日期
          hour,
          min,
          remark,
        }
      */
      let p = new Promise((resolve)=>{
        $.ajax({
            type: 'post',
            url: '/attendance_record/addCorrectionPunch', 
            data,
        }).done(function(res) {
          resolve(res);
        }).error(function(res) {
          resolve(res.responseJSON);
        });
      });
      return p;
    }

  // if ( hasAjax === true ){
    Promise.all( ajaxArray ).then((vals)=>{
      console.log( vals );
      let successVals = vals.filter((e)=> e.code === 200);
      alert('自動打卡完畢! '+ '共'+ successVals.length +'筆。');
      window.location.reload();
    })
  // }
}


// 他們的程式，抓取查詢的結果，在此覆蓋他們網站的fn。
function loadingData(t, e) {
  var a, n = $('select[name="work_status"]').val() || "1,4",
      o = ".tab-content",
      l = {
          absent: "absent",
          misspunch: "missedpunch",
          late: "late",
          leaveearly: "leaveearly",
          abnormal: "_147_punch_abnormal_short"
      };
  loadInBatch && e && 1 !== e || (e = 1, loadBatchStart(), a = Nueip.mask.start(o));
  var i = "action=" + t + "&loadInBatch=" + loadInBatch + "&loadBatchGroupNum=" + loadBatchGroupNum + "&loadBatchNumber=" + e + "&work_status=" + n,
      r = $("[name='ajax_url']").val();
  loadBatchSend[e] = $.post(r, i, (function(a) {
    console.log(a); //// CB
    window.CB_AttendanceData = a; //// CB
    return 1 === e && (dataQuantity = 0, $.each(a.data, (function(t, e) {
      if ($.each(e, (function(t, e) {
        dataQuantity++
      })), dataQuantity > verticalTableMaxNum) return !1
    })), dataTable = dtInit()), buildTableContent(a, t, e)
  }), "json").done((function(t) {
    var e = $("#abnormal").val(),
        a = $("#tablefilter").val();
    "1" == e ? ($(".ctrl-filter").each((function(t, e) {
      var n = $(e);
      if ("" == a) n.hasClass("active") || n.trigger("click");
      else {
        var o = l[a] || "";
        n.hasClass("active") || n.data("filter") != o || n.trigger("click")
      }
    })), $("#abnormal").val("0")) : datatableFilterSetting($(".ctrl-nofilter").hasClass("active") ? "0" : "1");
    jumpCorrection()
  })).error((function(t, n, l) {
    1 === e && Nueip.mask.end(o, a), console.log(l)
  }))
}