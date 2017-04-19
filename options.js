'use strict'
/**
 * Options JS
 */

var port = chrome.extension.connect({name: 'bomnibox'})

$(document).ready(function () {
  var s = $('.search')
  var r = $('#results')

  // on change option
  $('#titlesearch').on('change', function () {
    chrome.storage.sync.set({
      optionTitleSearch: $(this).prop('checked')
    }, function () {
      port.postMessage({'action': 'search', 'text': s.val()})
    })
  }).next().text(chrome.i18n.getMessage('option_titlesearch'))

  chrome.storage.sync.get('optionTitleSearch', function (data) {
    if (data && data.optionTitleSearch) $('#titlesearch').prop('checked', true)
  })

  var scrollToActive = function () {
    var t = r.children('.active').offset().top - $(window).height() + 70
    $(window).scrollTop(t)
  }

  var to = null
  s.one('keydown', function () {
    this.value = ''
  }).on('keyup', function (ev) {
    var el = $(this)
    clearTimeout(to)
    if (ev.keyCode === 13) {
      r.children('.active').trigger('click')
      ev.preventDefault()
    } else if (ev.keyCode === 38) {
      var a = r.children('.active')
      if (a.prev().length) {
        a.removeClass('active').prev().addClass('active')
        scrollToActive()
      }
      if (!r.children('.active').length) r.children().first().addClass('active')
      ev.preventDefault()
    } else if (ev.keyCode === 40) {
      var a = r.children('.active')
      if (a.next().length) {
        a.removeClass('active').next().addClass('active')
        scrollToActive()
      }
      if (!r.children('.active').length) r.children().first().addClass('active')
      ev.preventDefault()
    } else if (ev.keyCode === 46) {
      var a = r.children('.active')
      port.postMessage({'action': 'delete', 'url': a.attr('data-url')})
      a.remove()
      ev.preventDefault()
    } else {
      to = setTimeout(function () {
        var v = el.val().trim()
        if (!v.length || ev.ctrlKey || chrome.i18n.getMessage('searchInput') === v) {
          r.hide()
          return
        }
        port.postMessage({'action': 'search', 'text': v})
      }, 100)
    }
  })
  r.on('click', '> div', function (ev) {
    window.open($(ev.currentTarget).attr('data-url'))
    window.close()
  })
  $('.help-icon').on('click', function () {
    $('#help').fadeToggle()
  })
  port.onMessage.addListener(function (data) {
    if (data.action === 'search-callback') {
      r.hide()
      if (data.suggestions.length) {
        r.html('').show()
        var w = r.width() - 20
        data.suggestions.forEach(function (entry) {
          r.append('<div data-url="' + entry.content + '" style="width:' + w + 'px">' + entry.description + '</div>')
        })
        r.children().first().addClass('active')
      }
    }
  })
  s.val(chrome.i18n.getMessage('searchInput')).focus()
  $('#help')
    .append($('<h3>').text(chrome.i18n.getMessage('help_1')))
    .append($('<p>').html(chrome.i18n.getMessage('help_2').replace(/\%s/, '<b>local phpmy</b>').replace(/\%s/, '<b>local</b>').replace(/\%s/, '<b>phpmy</b>').replace(/\n/ig, '<br/>')))
    .append($('<h3>').text(chrome.i18n.getMessage('help_3')))
    .append($('<p>').text(chrome.i18n.getMessage('help_4')))
})
