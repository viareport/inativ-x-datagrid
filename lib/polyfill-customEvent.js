(function () {
    function doesSupportCustomEventConstructor() {
        try {
//            var test = new CustomEvent();
//            if (!test) {
//                return false;
//            }else
            if (new Event('submit', { bubbles: false }).bubbles !== false) {
                return false;
            } else if (new Event('submit', { bubbles: true }).bubbles !== true) {
                return false;
            } else if (new Event('submit', { detail: 'toto'}).detail !== 'toto') {
                return false;
            } else {
                return true;
            }
        } catch (e) {
            return false;
        }
    }


    if (!doesSupportCustomEventConstructor()) {
        window.CustomEvent = function CustomEvent(event, params) {
            params = params || { bubbles: false, cancelable: false, detail: undefined };
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        };

        window.CustomEvent.prototype = window.CustomEvent.prototype;
    }

})();
