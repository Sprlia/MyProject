(function($){
    'use strict'
    const name_space = "customScroll";
    var scroll_id = 0;

    $.fn.scrollbar = function() {
        var method = arguments[0];

        if(methods[method]){
            method = methods[method];
            arguments = Array.prototype.slice.call(arguments, 1);
        } else if(typeof(method)=='object' || !method){
            method = methods.init;
        } else {
            $.error('method ' + method + 'does not exist');
            return this;
        }
        return method.apply(this, arguments);
    };

    var defaults = {
    };

    var methods = {
        init: function(options){
            let options = $.extend(true, {}, defaults, options);

            return $(this).each(function(){
                let _this = this;

                $(_this).css("overflow", "hidden");
                if(!$(_this).data(name_space)) {
                    $(_this).data(name_space, {
                        index: ++scroll_id,
                        opt: options,
                        overflowed: null
                    });

//                    proto.makescrollbar.call(_this);
//                    proto.bindevents.call(_this);
//                    auto_update_size;
                }
            });
        }
    };

    var proto = {
    };

})(JQuery);

















