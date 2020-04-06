﻿exports.newEventsServerClient = function newEventsServerClient() {

    const MODULE = "Task Server "
    const ERROR_LOG = true
    const INFO_LOG = false

    let thisObject = {
        initialize: initialize,
        finalize: finalize,
        createEventHandler: createEventHandler,
        deleteEventHandler: deleteEventHandler,
        listenToEvent: listenToEvent,
        stopListening: stopListening,
        raiseEvent: raiseEvent
    }

    let eventListeners = new Map()
    let responseWaiters = new Map()

    let WEB_SOCKETS_CLIENT
    const WEB_SOCKET = require('ws')
    let port = process.env.WEB_SOCKETS_SERVER_PORT  

    return thisObject

    function initialize(callBackFunction) {

        setuptWebSockets(callBackFunction)

    }

    function setuptWebSockets(callBackFunction) {
        try {

            WEB_SOCKETS_CLIENT = new WEB_SOCKET('ws://localhost:' + port ) 

            WEB_SOCKETS_CLIENT.onerror = error => {
                console.log('[ERROR] Task Server -> Event Server Client -> setuptWebSockets -> On connection error -> error = ' + JSON.stringify(error))
            }
            WEB_SOCKETS_CLIENT.onopen = () => {
                if (INFO_LOG === true) {
                    console.log('Websocket connection opened.')
                }

                if (callBackFunction !== undefined) {
                    callBackFunction()
                }
            }
            WEB_SOCKETS_CLIENT.onmessage = e => {

                try {
                    if (INFO_LOG === true) {
                        console.log('Websocket Message Received: ' + e.data)
                    }

                    let message = JSON.parse(e.data)

                    if (message.action === 'Event Raised') {
                        let key
                        if (message.callerId !== undefined) {
                            key = message.eventHandlerName + '-' + message.eventType + '-' + message.callerId
                        } else {
                            key = message.eventHandlerName + '-' + message.eventType
                        }
                        let handler = eventListeners.get(key)
                        if (handler) {
                            handler.callBack(message)
                        }
                        return
                    }

                    if (message.action === 'Event Server Response') {
                        let handler = responseWaiters.get(message.callerId)
                        if (handler) {
                            handler(message)
                        }
                        return
                    }
                } catch (err) {
                    if (ERROR_LOG === true) { logger.write('[ERROR] Task Server -> Event Server Client -> setuptWebSockets ->  onmessage -> err = ' + err.stack) }
                }
            }
        } catch (err) {
            if (ERROR_LOG === true) { logger.write('[ERROR] Task Server -> Event Server Client -> setuptWebSockets ->  err = ' + err.stack) }
        }
    }

    function finalize() {
        /* Before disconnecting we will forze all eventListeners to stop listening. */
        const eventListenersArray = [...eventListeners.values()]
        for (let i = 0; i < eventListenersArray.length; i++) {
            let handler = eventListenersArray[i]
            let eventCommand = {
                action: 'stopListening',
                eventHandlerName: handler.eventHandlerName,
                eventType: handler.eventType,
                callerId: handler.callerId
            }
            sendCommand(eventCommand)
        }
        WEB_SOCKETS_CLIENT.close();
    }

    function sendCommand(command, responseCallBack, eventsCallBack) {

        if (command.action === 'listenToEvent') {
            let key
            if (command.callerId) {
                key = command.eventHandlerName + '-' + command.eventType + '-' + command.callerId
            } else {
                key = command.eventHandlerName + '-' + command.eventType
            }
            let handler = {
                eventHandlerName: command.eventHandlerName,
                eventType: command.eventType,
                callerId: command.callerId,
                callBack: eventsCallBack
            }
            eventListeners.set(key, handler)
        }
        if (command.callerId && responseCallBack) {
            responseWaiters.set(command.callerId, responseCallBack)
        }

        if (WEB_SOCKETS_CLIENT.readyState === 1) { // 1 means connected and ready.
            WEB_SOCKETS_CLIENT.send("Task Server||" + JSON.stringify(command))
        } else {
            console.log('[ERROR] Task Server -> Event Server Client -> setuptWebSockets -> sendCommand -> WebSocket message could not be sent because the connection was not ready. Message = ' + JSON.stringify(command))
        }
    }

    function createEventHandler(eventHandlerName, callerId, responseCallBack) {
        let eventCommand = {
            action: 'createEventHandler',
            eventHandlerName: eventHandlerName,
            callerId: callerId
        }
        sendCommand(eventCommand, responseCallBack)
    }

    function deleteEventHandler(eventHandlerName, callerId, responseCallBack) {
        let eventCommand = {
            action: 'deleteEventHandler',
            eventHandlerName: eventHandlerName,
            callerId: callerId
        }
        sendCommand(eventCommand, responseCallBack)
    }

    function listenToEvent(eventHandlerName, eventType, extraData, callerId, responseCallBack, eventsCallBack) {
        let eventCommand = {
            action: 'listenToEvent',
            eventHandlerName: eventHandlerName,
            eventType: eventType,
            extraData: extraData,
            callerId: callerId
        }
        sendCommand(eventCommand, responseCallBack, eventsCallBack)
    }

    function stopListening(eventHandlerName, eventType, eventSubscriptionId, callerId, responseCallBack) {
        /* User either needs to specify a valid eventSubscriptionId OR the 3 params: eventHandlerName, eventType, callerId which were used when start listening to events. */
        let eventCommand = {
            action: 'stopListening',
            eventHandlerName: eventHandlerName,
            eventType: eventType,
            eventSubscriptionId: eventSubscriptionId,
            callerId: callerId
        }
        sendCommand(eventCommand, responseCallBack)
    }

    function raiseEvent(eventHandlerName, eventType, event, callerId, responseCallBack) {
        let eventCommand = {
            action: 'raiseEvent',
            eventHandlerName: eventHandlerName,
            eventType: eventType,
            event: event,
            callerId: callerId
        }
        sendCommand(eventCommand, responseCallBack)
    }
}