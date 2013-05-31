/*jslint browser: true, nomen: true, todo: true */
(function ($, window, document) {
    'use strict';

    var P, Parallaxin, px, pct;

    px = function (n) { return {value: n, px: true}; };
    pct = function (n) { return {value: n, pct: true}; };

    P = Parallaxin = function () {};
    Parallaxin.instances = [];

    Parallaxin.prototype = {
        optionAttributePrefix: 'data-parallaxin-',

        defaultOptions: {
            // The container element. Defaults to the parent of the selected element.
            container: null,

            // Should the element move vertically?
            vertical: true,

            // Should the element move horizontally?
            horizontal: false,

            // Does the container change sizes?
            responsive: false,

            // Contrain the range of motion within the container. Can be a
            // string or array, specified in the order "top", "right", "bottom",
            // "left." If less than four values are provided, they will be
            // expanded like with CSS. For example, the following are all
            // equivalent: `0`, `'0'`, `'0 0'`, `'0 0 0 0'` `[0]`, `[0, 0]`,
            // `[0, 0, 0, 0]`. Percentage values are also allowed.
            insets: 0
        },

        initialize: function ($el, options) {
            this.$el = $el;
            this.options = $.extend(this.defaultOptions, this.getHtmlOptions(), options);
            if (this.options.container) {
                this.$container = $(this.options.container);
            } else {
                this.$container = this.$el.parent();
            }
            this._insets = this.parseInsets(this.options.insets);

            if (!P.$win) {
                P.$win = $(window);
            }
            if (!P._hasScrollHandler) {
                P._hasScrollHandler = true;
                P.$win.on('scroll', P.onScroll);
            }
            if (!P._hasResizeHandler && this.options.responsive) {
                P._hasResizeHandler = true;
                P.$win.on('resize', P.onWindowResize);
            }

            P.instances.push(this);
            this.update();
            return this;
        },

        destroy: function () {
            var index = P.instances.indexOf(this);
            P.instances.splice(index, 1);
            return this;
        },

        // Update the position of the element.
        update: function () {
            var
                recalculateContainerSize = this.options.responsive,
                recalculateSize = this.options.responsive,
                // TODO: Performance could be improved if there could be an option for setting this to false and a way to do it manually. (Gotta figure out a good name for the option.)
                recalculateContainerPosition = true,
                bounds = this._bounds,
                size = this._size,
                containerSize = this._containerSize,
                containerPosition = this._containerPosition,
                scrollPosition = P.getScrollPosition(),
                windowSize = P.getWindowSize(),
                css = {};

            if (recalculateContainerSize || !containerSize) {
                containerSize = this._containerSize = this.calculateElSize(this.$container);
                bounds = this._bounds = this.calculateBounds(this._insets, containerSize);
            }

            if (recalculateSize || !size) {
                size = this._size = this.calculateElSize(this.$el);
            }

            if (recalculateContainerPosition || !containerPosition) {
                // Unlike sizes, jQUery calculates both vertical and horizontal
                // positions with one measurement, so no need to use `forAxes`.
                containerPosition = this._containerPosition = this.$container.offset();
            }

            this.forAxes(
                function () {
                    css.left = this.updatePosition(bounds.L, bounds.R,
                        containerPosition.left, containerSize.width, size.width,
                        scrollPosition.left, windowSize.width);
                },
                function () {
                    css.top = this.updatePosition(bounds.T, bounds.B,
                        containerPosition.top, containerSize.height,
                        size.height, scrollPosition.top, windowSize.height);
                }
            );

            if (css.left !== undefined || css.top !== undefined) {
                this.$el.css(css);
            }
        },

        updatePosition: function (boundsMin, boundsMax, containerPosition, containerSize, elSize, scrollPosition, windowSize) {
            // When the container is at the top of the viewport (min scrollTop),
            // $el should be aligned to its top. When the container is at the
            // bottom of the viewport (max scrollTop), $el should be aligned to
            // the bottom.
            var min, max, pct, targetMin, targetMax, pos;

            if (containerPosition + containerSize < scrollPosition) {
                // Container is above viewport.
                return undefined;
            }
            if (containerPosition > scrollPosition + windowSize) {
                // Container is below viewport.
                return undefined;
            }

            if (elSize <= windowSize) {
                max = containerPosition;
                min = containerPosition + containerSize - windowSize;
                targetMin = boundsMax - elSize;
                targetMax = boundsMin;
            } else {
                min = containerPosition - windowSize;
                max = containerPosition + containerSize;
                targetMin = boundsMin - elSize;
                targetMax = boundsMax;
            }

            pct = (scrollPosition - min) / (max - min);
            pos = targetMin + pct * (targetMax - targetMin);
            return pos;
        },

        // A utility that lets us avoid doing things we don't need to given the
        // axes of this instance.
        forAxes: function (horizontalFn, verticalFn) {
            if (this.options.horizontal) {
                horizontalFn.call(this);
            }
            if (this.options.vertical) {
                verticalFn.call(this);
            }
        },

        calculateElSize: function ($el) {
            var size = {};
            this.forAxes(
                function () { size.width = $el.outerWidth(true); },
                function () { size.height = $el.outerHeight(true); }
            );
            return size;
        },

        calculateBound: function (inset, size, fromOpposite) {
            if (inset.pct) {
                return this.calculateBound(px(inset.value * size), size, fromOpposite);
            }
            if (fromOpposite) {
                return size - inset.value;
            }
            return inset.value;
        },

        // Convert parsed insets into actual pixel positions based on the size
        // of the container.
        calculateBounds: function (insets, containerSize) {
            var bounds = {};
            this.forAxes(
                function () {
                    bounds.R = this.calculateBound(insets.R, containerSize.width);
                    bounds.L = this.calculateBound(insets.L, containerSize.width, true);
                },
                function () {
                    bounds.T = this.calculateBound(insets.T, containerSize.height);
                    bounds.B = this.calculateBound(insets.B, containerSize.height, true);
                }
            );
            return bounds;
        },

        parseInset: function (val) {
            switch ($.type(val)) {
            case 'number':
                return px(val);
            case 'string':
                if (val.indexOf('%') > -1) {
                    return pct(parseFloat(val) / 100);
                }
                return px(parseInt(val, 10));
            }
        },

        // Parse inset options into numbers and units corresponding to each
        // side.
        parseInsets: function (val) {
            var parsed, a, v, h, t, r, b, l;

            switch ($.type(val)) {
            case 'number':
                return {T: px(val), R: px(val), B: px(val), L: px(val)};
            case 'array':
                switch (val.length) {
                case 1:
                    a = this.parseInset(val[0]);
                    return {T: a, R: a, B: a, L: a};
                case 2:
                    v = this.parseInset(val[0]);
                    h = this.parseInset(val[1]);
                    return {T: v, R: h, B: v, L: h};
                case 4:
                    t = this.parseInset(val[0]);
                    r = this.parseInset(val[1]);
                    b = this.parseInset(val[2]);
                    l = this.parseInset(val[4]);
                    return {T: t, R: r, B: b, L: l};
                }
                break;
            case 'string':
                return this.parseInsets(val.replace(/^\s+|\s+$/, '').split(/\s+/));
            }
        },

        getHtmlOptions: function () {
            var self = this,
                opts = {};
            $.each(this.$el[0].attributes, function (i, attr) {
                if (attr.name.indexOf(self.optionAttributePrefix) !== -1) {
                    opts[attr.name.substr(self.optionAttributePrefix.length)] = attr.value;
                }
            });
            return opts;
        }
    };


    Parallaxin.getScrollPosition = function (recalculate) {
        if (recalculate || !P._scrollPosition) {
            P._scrollPosition = {
                top: P.$win.scrollTop(),
                left: P.$win.scrollLeft()
            };
        }
        return P._scrollPosition;
    };

    Parallaxin.getWindowSize = function (recalculate) {
        if (recalculate || !P._windowSize) {
            P._windowSize = {
                width: P.$win.width(),
                height: P.$win.height()
            };
        }
        return P._windowSize;
    };

    Parallaxin.onScroll = function () {
        var oldPos = P._scrollPosition,
            pos = P.getScrollPosition(true),
            topChanged = oldPos && oldPos.top !== pos.top,
            leftChanged = oldPos && oldPos.top !== pos.top;
        $.each(P.instances, function (index, value) {
            if ((topChanged && value.options.vertical) || (leftChanged && value.options.horizontal)) {
                value.update();
            }
        });
    };

    Parallaxin.onWindowResize = function () {
        P.getWindowSize(true);
        $.each(P.instances, function (index, value) {
            if (value.options.responsive) {
                value.update();
            }
        });
    };


    $.extend($.fn, {
        parallaxin: function (optionsOrMethod) {
            var returnValue = this,
                args = arguments;
            this.each(function (i, el) {
                var $el = $(el),
                    plugin = $el.data('parallaxin'),
                    method = typeof optionsOrMethod === 'string' ? optionsOrMethod : null,
                    options = method === null ? optionsOrMethod || {} : {};

                if (!plugin) {
                    if (method) {
                        $.error('You can\'t call the parallaxin method "' + method
                                + '" without first initializing the plugin by calling '
                                + 'parallaxin() on the jQuery object.');
                    } else {
                        plugin = new Parallaxin().initialize($el, options);
                        $el.data('parallaxin', plugin);
                    }
                } else if (method) {
                    if (typeof plugin[method] !== 'function') {
                        $.error('Method "' + method + '" does not exist on jQuery.parallaxin');
                    } else {
                        // NOTE: If you call a method that returns a value, you will only get the result from the last item in the collection.
                        returnValue = plugin[method].apply(plugin, Array.prototype.slice.call(args, 1));
                    }
                }
            });
            return returnValue;
        }
    });
}(this.jQuery, window, document));
