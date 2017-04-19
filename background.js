'use strict'
/**
 * Background JS
 */

var optionTitleSearch = false

// get option from storage
chrome.storage.sync.get(['optionTitleSearch'], function (data) {
  optionTitleSearch = data && data.optionTitleSearch
})

// changed handler to keep notice of option change
chrome.storage.onChanged.addListener(function (changes, namespace) {
  if (namespace === 'sync') {
    for (var key in changes) {
      if (key === 'optionTitleSearch') {
        optionTitleSearch = changes[key].newValue
      }
    }
  }
})

// escape string for omnibox use
var escapeUrl = function (url) {
  return url.replace(/\&/g, '&amp;').replace(/\"/g, '&quot;').replace(/\'/g, '&apos;').replace(/\</g, '&lt;').replace(/\>/g, '&gt;')
}

// unescape string for omnibox use
var unescapeUrl = function (url) {
  return url.replace(/\&quot\;/g, '"').replace(/\&apos\;/g, '\'').replace(/\&lt\;/g, '<').replace(/\&gt\;/g, '>').replace(/\&amp\;/g, '&')
}

// on do search - when user typed in the omnibox
var onSearch = function (text, suggest) {
  var found = []
  var s = text.trim().split(' ')
  var sRegex = s
  for (var i in sRegex) {
    sRegex[i] = {'regex': new RegExp(sRegex[i].replace(/[^0-9a-z]/ig, '\\$&'), 'ig'), 'val': s[i]}
  }

  // go through each item and do the search thingy
  itemsCache.forEach(function (item) {
    // not search in chrome url
    if (item.url.match(/^chrome/)) return true
    var ok = true
    sRegex.forEach(function (val) {
      if (optionTitleSearch && !(item.title.match(val.regex) || item.url.match(val.regex))) ok = false
      else if (!optionTitleSearch && !item.url.match(val.regex)) ok = false
      if (!ok) return false
    })
    if (ok) found.push(item)
  })

  // resort by visit count
  found.sort(function (a, b) {
    if (a.visitCount > b.visitCount) return -1
    if (a.visitCount < b.visitCount) return 1
    return 0
  })

  // just slice the best 50 entries
  found = found.slice(0, 50)

  // generate suggestions array
  var suggestions = []
  found.forEach(function (item) {
    var uDesc = item.url
    var highlightedTitle = item.title
    sRegex.forEach(function (val) {
      uDesc = uDesc.replace(val.regex, '{match}' + val.val + '{/match}')
      if (optionTitleSearch) highlightedTitle = highlightedTitle.replace(val.regex, '{match}' + val.val + '{/match}')
    })
    uDesc = escapeUrl(uDesc).replace(/{match}/ig, '<match>').replace(/{\/match}/ig, '</match>')
    if (optionTitleSearch) highlightedTitle = escapeUrl(highlightedTitle).replace(/{match}/ig, '<match>').replace(/{\/match}/ig, '</match>')

    suggestions.push({
      'content': escapeUrl(item.url),
      'description': '<url>' + uDesc + '</url> :: <dim>' + item.visitCount + ' ' + chrome.i18n.getMessage('visits') + '</dim> ' + highlightedTitle
    })
  })

  // omnibox suggest
  if (suggest) suggest(suggestions)
  return suggestions
}

// cache history entries
var itemsCache = []
var updateCache = function () {
  chrome.history.search({'text': '', 'maxResults': 2147483647, 'startTime': 0}, function (items) {
    itemsCache = items
  })
}

// refresh items cache every 5 minutes
setInterval(updateCache, 5 * 60 * 1000)

// on init create the cache
updateCache()

// default suggestion text
chrome.omnibox.setDefaultSuggestion({'description': chrome.i18n.getMessage('omniboxDefault')})

// when user typed in the omnibox
chrome.omnibox.onInputChanged.addListener(onSearch)

// on enter or select the current entry
chrome.omnibox.onInputEntered.addListener(function (text, type) {
  if (type !== 'currentTab') {
    chrome.tabs.create({url: text, active: type === 'newForegroundTab'})
  } else {
    chrome.tabs.query({lastFocusedWindow: true, windowType: 'normal'}, function (tab) {
      chrome.tabs.update(tab.id, {url: text}, function () {})
    })
  }
})

// key shortcuts
chrome.commands.onCommand.addListener(function (command) {
  if (command === 'open') {
    var w = 600
    var h = 400
    var l = screen.width / 2 - w / 2
    var t = screen.height / 2 - h / 2
    chrome.windows.create({
      'url': chrome.extension.getURL('options.html'),
      'type': 'popup',
      'width': w,
      'height': h,
      'left': l,
      'top': t
    }, function () {

    })
  }
})

// on connect from options page
chrome.extension.onConnect.addListener(function (port) {
  if (port.name === 'bomnibox') {
    port.onMessage.addListener(function (data) {
      if (data.action === 'search') {
        if (port) {
          port.postMessage({'action': 'search-callback', 'suggestions': onSearch(data.text, null)})
        }
      }
      if (data.action === 'delete') {
        if (port) {
          chrome.history.deleteUrl({'url': unescapeUrl(data.url)}, updateCache)
        }
      }
    })
  }
  port.onDisconnect.addListener(function () {
    port = null
  })
})
