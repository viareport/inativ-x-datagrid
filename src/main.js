require('inativ-x-inputfilter');
(function () {
    // Structure manipulé par le content du datagrid
    //[
    //  {
    //      originIndex: integer,
    //      rowValue: [
    //          Cell,
    //          Cell
    //      ]
    //  },
    //  {originIndex: integer, rowValue: []}
    //]
    'use strict';
    /* Methods ou on a juste un wrapper (x-datagrid) autour d'une table */
    /* Les perfs sont meilleurs qu'avec l'autre technique, mais il faudrait quand même utiliser la technique de w2ui */
    function escapeRegExp(string) {
        return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function defaultTemplate(value) {
        if (value === null) {
            return '';
        }
        return value;
    }

    function defaultFilterFunction(element, regex) {
        return regex.test(element);
    }

    xtag.register('x-datagrid', {
        lifecycle: {
            created: function created() {
                this.contentWrapper = document.createElement('div');
                this.contentWrapper.setAttribute('class', 'contentWrapper'); //FIXME no camel case
                this.tableContent = document.createElement("table");
                this.contentWrapper.appendChild(this.tableContent);
                this.columnHeaderWrapper = document.createElement('div');
                this.columnHeaderWrapper.setAttribute('class', 'columnHeaderWrapper'); //FIXME no camel case
                this.rowHeight = getTrHeight();
                this.appendChild(this.columnHeaderWrapper);
                this.appendChild(this.contentWrapper);
                this._scrollTop = 0;
                this._filters = [];
                this.lastCurrentRow = 0;
                this.scrollBarWidth = getScrollBarWidth();
                this.tableMinWidth = 0;
                this.plugins = [];
                this.firstRowCreate = null;

                this.cellMinWidth = Number(this.getAttribute('cell-width') || 150);
                
            },
            inserted: function inserted() {
                var grid = this;
                this.originOnResize = window.onresize || function(){};
                window.onresize = function () {
                    grid.originOnResize();
                    grid.calculateContentSize();
                    grid.calculateHeaderWidth(grid.displayedData.length);
                    grid.plugins.forEach(function(plugin){
                        plugin.onResize();
                    });
                };
            },
            removed: function removed() {
                window.onresize = this.originOnResize;
            },
            attributeChanged: function attributedChanged() {
            //TODO editable
            }
        },
        events: {
            contentUpdated: function contentUpdated() {
                this._displayedData = null;
                this.renderContent(this.lastCurrentRow);
            },
            headerUpdated: function headerUpdated() {
                this.calculateMinimumWidth(this.cellMinWidth);
                this.renderHeaders(this.data);
            },
            scroll: function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (e.target === this.contentWrapper) {
                    //this._scrollTop = Number(e.target.scrollTop);
                    var currentRow = this.calculateCurrentLine(Number(e.target.scrollTop));

                    var diffBetweenLastCurrentRow = Math.abs(currentRow - this.lastCurrentRow);
                    if (diffBetweenLastCurrentRow > this._nbRowDisplay) {
                        this.lastCurrentRow = currentRow;
                        this.renderContent(currentRow);
                    }
                }
            },
            filter: function (e) {
                this._displayedData = null;
                this.lastCurrentRow = 0;
                if (e.detail.filterValue === undefined || e.detail.filterValue === "") {
                    delete this._filters[e.detail.filterType];
                } else {
                    this._filters[e.detail.filterType] = e.detail.filterValue;
                }
                this.contentWrapper.scrollTop = 0;
                this.renderContent(0);
            }
        },
        accessors: {
            data: {
                set: function (data) {
                    this._data = {};
                    this.header = data.colHeader;
                    this.content = data.content;
                },
                get: function () {
                    return this._data;
                }
            },
            header: {
                set: function (header) {
                    this._data.colHeader = header;
                    var event = new CustomEvent('headerUpdated');
                    this.dispatchEvent(event);
                },
                get: function () {
                    return this._data.colHeader;
                }
            },
            content: {
                set: function (content) {
                    this._data.content = []; // Okazou on viendrait du setData
                    this._nbRow = content.length;

                    for (var i = 0; i < content.length; i++) {
                        this._data.content.push({
                            originIndex: i,
                            rowValue: content[i]
                        }); // filteredIndex viendra se rajouter (cf renderContent et applyFilter). L'initialiser à i ?
                    }
                    var event = new CustomEvent('contentUpdated');
                    this.dispatchEvent(event);
                },
                get: function () {
                    throw new Error("No getter available on datagrid content");
                }
            },
            displayedData: {
                get: function () {
                    if (!this._displayedData) {
                        var filteredData = this._data.content;

                        this._filters.forEach(function (filter, columnIndex) {
                            filteredData = this.applyFilter(filter, columnIndex, filteredData);
                        }, this);

                        this._displayedData = filteredData;
                    }

                    return this._displayedData;
                }
            }

        },
        methods: {
            registerPlugin: function register(plugin) {
                plugin.datagrid = this;
                plugin.append();
                this.plugins.push(plugin);
            },
            render: function render(data, firstDisplay) {
                firstDisplay = firstDisplay || 0;
                var displayData = data || this._data;
                this.renderHeaders(displayData);
                this.renderContent(firstDisplay);
            },
            renderHeaders: function renderHeaders(data) {
                var tableColHeader = document.createElement("table");

                if (!data) {
                    return;
                }
                for (var j = 0; j < data.colHeader.length; j++) {
                    var trHeader = document.createElement("tr");
                    var colHeader;
                    for (var i = 0; i < data.colHeader[j].length; i++) {
                        colHeader = data.colHeader[j][i];
                        var tdHeader = this.renderHeader(colHeader, i);
                        trHeader.appendChild(tdHeader);
                    }
                    tableColHeader.appendChild(trHeader);
                }
                this.columnHeaderWrapper.innerHTML = '';
                this.columnHeaderWrapper.appendChild(tableColHeader);
                this.calculateContentSize();
            },
            renderHeader: function renderHeader(colHeader, coldIdx) {
                var tdHeader = document.createElement("th");
                if (colHeader.class) {
                    colHeader.class.forEach(function(elem){
                        tdHeader.classList.add(elem);
                    });
                }
                if (this.header[0][coldIdx].columnClass) {
                    tdHeader.classList.add(this.header[0][coldIdx].columnClass);
                }
                if (this.header[0][coldIdx].width) {
                    tdHeader.style.width = this.header[0][coldIdx].width + "px";
                }
                if (colHeader.element) {
                    tdHeader.appendChild(colHeader.element);
                } else {
                    tdHeader.setAttribute('class', tdHeader.getAttribute('class') + ' ' + 'sortable');
                    if (colHeader.rowspan) {
                        tdHeader.setAttribute('rowspan', colHeader.rowspan);
                    }
                    tdHeader.innerHTML = "<div class='x-datagrid-cell'>" + colHeader.value + "</div>";
                    if (colHeader.filter) {
                        var filter = document.createElement('x-inputfilter');
                        if (colHeader.defaultFilter) {
                            filter.setAttribute('defaultFilter', colHeader.defaultFilter);
                            this._filters[coldIdx] = colHeader.defaultFilter;
                        }
                        filter.setAttribute('filterType', coldIdx);
                        tdHeader.appendChild(filter);
                    }
                }
                return tdHeader;
            },
            renderContent: function renderContent(currentRowDisplay) {
                var displayData = this.displayedData;
                var tableContentFragment = document.createDocumentFragment();
                var lastRowCreate = Math.min(displayData.length, currentRowDisplay + this._nbRowDisplay + this.cachedRow);

                this.firstRowCreate = Math.max(0, currentRowDisplay - this.cachedRow);

                this.calculateHeaderWidth(displayData.length);

                var rowIndex = this.firstRowCreate;
                // Création de la première ligne qui doit simuler la taille de toutes les lignes présentes avant la ligne courante
                if (currentRowDisplay !== this.firstRowCreate) {
                    tableContentFragment.appendChild(this.simulateMultiRow(this.firstRowCreate));
                    this.firstRowCreate--;
                }
                var fragment = document.createDocumentFragment();
                for (; rowIndex < lastRowCreate; rowIndex++) {
                    var tr = document.createElement("tr");
                    tr.setAttribute('class', 'x-datagrid-tr');
                    displayData[rowIndex].filteredIndex = rowIndex;
                    var columnIndex = 0;
                    for (; columnIndex < displayData[rowIndex].rowValue.length; columnIndex++) {
                        var cellData = displayData[rowIndex].rowValue[columnIndex],
                            td = document.createElement("td");

                        // TODO au lieu de ça, injecter la cell dans le td
                        if (this.header[0][columnIndex].width) {
                            td.style.width = this.header[0][columnIndex].width + "px";
                        }
                        if (this.header[0][columnIndex].columnClass) {
                            td.classList.add(this.header[0][columnIndex].columnClass);
                        }
                        td.cellValue = cellData.value;
                        td.cellRow = displayData[rowIndex].originIndex;
                        if (cellData.cellClass) {
                            td.className = ' ' + cellData.cellClass;
                        }
                        td.classList.add('x-datagrid-td');
                        //td.setAttribute('class', ['x-datagrid-td', cellData.cellClass || null].join(' '));       // FIXME utiliser classlist

                        if (cellData.events) {
                            this.bindCustomEvents(cellData.events, td);
                        }
                        td.innerHTML = '';
                        if(cellData.errorMessage){         // c'est pas beau mais impossible de passer par le dataset pour un tooltip css (pas de polyfill pour IE)
                            td.innerHTML += '<span class="error-message">'+cellData.errorMessage+'</span>';
                        }
                        //TODO : class pourrait etre un tableau
                        var cellClass = (cellData.class && cellData.class.join(' ')) || '';
                        td.innerHTML += "<div class='x-datagrid-cell " + cellClass + "'>" + this.getCellTemplate(columnIndex)(cellData.value) + "</div>";
                        tr.appendChild(td);
                    }
                    fragment.appendChild(tr);
                }
                tableContentFragment.appendChild(fragment);
                // S'il y a plus de lignes que celles que l'on affiche
                if (lastRowCreate < displayData.length) {
                    var nbRowAfterCurrent = displayData.length - lastRowCreate;
                    tableContentFragment.appendChild(this.simulateMultiRow(nbRowAfterCurrent));
                    //et on en profite pour enlever la taille du scroll sur le tableau des colonnes headers
                }
                this.tableContent.innerHTML = '';

                this.tableContent.appendChild(tableContentFragment);

            },
            getCellTemplate: function getCellTemplate(columnIndex) {
                return this.header[0][columnIndex].cellTemplate || defaultTemplate;
            },
            sort: function sortData(columnIndex) {
                if (!columnIndex) {
                    throw new Error('a pas le column index pour sorter la data');
                }
                var displayData = new Object(this._data);
                var sortedData = displayData.slice(0);
                sortedData.sort(function (a, b) {
                    return a[columnIndex] - b[columnIndex];
                });
                displayData = sortedData;
                return displayData;
            },
            calculateHeaderWidth: function calculateHeaderWidth(nbSource) {
                this.columnHeaderWrapper.style.width = "100%";
                if (nbSource > this._nbRowDisplay) {
                    this.columnHeaderWrapper.style.width = (this.columnHeaderWrapper.offsetWidth - this.scrollBarWidth) + 'px';
                    this.columnHeaderWrapper.style.minWidth = (this.tableMinWidth - this.scrollBarWidth) + 'px';
                } else {
                    this.columnHeaderWrapper.style.minWidth = this.tableMinWidth + 'px';
                }
            },
            calculateMinimumWidth: function calculateMinimumWidth(cellMinWidth) {
                this.tableMinWidth = 0;
                var table = document.createElement("table");
                var trHeader = document.createElement("tr");
                var ths = [];
                for (var i = 0; i < this.header[0].length; i++) {
                    var colHeader = this.header[0][i];
                    var tdHeader = document.createElement("th");
                    if (colHeader.columnClass) {
                        tdHeader.classList.add(colHeader.columnClass);
                    }
                    tdHeader.style.width = cellMinWidth + 'px';
                    if (colHeader.width) {
                        tdHeader.style.width = colHeader.width + 'px';
                    }
                    ths.push(tdHeader);
                    trHeader.appendChild(tdHeader);
                }
                table.appendChild(trHeader);
                document.body.appendChild(table);
                this.tableMinWidth = trHeader.offsetWidth;
                document.body.removeChild(table);
            },
            calculateContentSize: function calculateContentSize() {
                var contentWrapperHeight = this.offsetHeight - this.columnHeaderWrapper.offsetHeight;
                if (contentWrapperHeight <= 0) {
                    throw new Error("Wrong height calculated: " + contentWrapperHeight + "px. Explicitly set the height of the parent elements (consider position: absolute; top:0; bottom:0)");
                }

                var totalMinWidth = this.header[0].reduce(function sumWidth(total, header) {
                        return total + (header.width || this.cellMinWidth);
                    }.bind(this), 0);

                if (totalMinWidth > this.offsetWidth) {
                    contentWrapperHeight -= this.scrollBarWidth;
                } else {
                    this.contentWrapper.style.width = '100%';
                }
                this.contentWrapper.style.height = contentWrapperHeight + 'px';
                this.contentWrapper.style.minWidth = this.tableMinWidth + 'px';

                this._nbRowDisplay = Math.floor(contentWrapperHeight / this.rowHeight);
                this.cachedRow = this._nbRowDisplay * 2;
            },
            calculateCurrentLine: function getDisplayFirstLine(scrollTop) {
                var currentLine = Math.round(scrollTop / this.rowHeight);
                return  currentLine;
            },
            applyFilter: function applyFilter(filter, columnIndex, data) {
                if (columnIndex === undefined) {
                    throw new Error('Empty column index');
                }

                var regExp = new RegExp('^' + escapeRegExp(filter), "i"),
                    datagrid = this;

                return data.filter(function (row) {
                    var elem = row.rowValue[columnIndex].value,
                        filterFn = datagrid.header[0][columnIndex].filterFn || defaultFilterFunction,
                        isIncluded = filterFn(elem, regExp);
                    if (! isIncluded) {
                        row.filteredIndex = -1;
                    }
                    return isIncluded;
                });
            },
            simulateMultiRow: function (nbRow) {
                var tr = document.createElement("tr");
                var td;
                var i = 0;
                for(;i<this.header[0].length;i++) {
                    td = document.createElement("td");
                    if(this.header[0][i].width) {
                        td.style.width = this.header[0][i].width + "px";
                    }
                    tr.appendChild(td);
                }
                tr.style.height = (nbRow * this.rowHeight) + 'px';
                return tr;
            },
            
            //TODO : privée ? bindCellEvts ?
            bindCustomEvents: function (eventsTab, element) {
                var events = eventsTab;
                var eventTypes = Object.keys(events);
                var that = this;
                eventTypes.forEach(function (eventType) {
                    var eventName = eventType;
                    var customEventName = events[eventName].event;
                    
                    if (events[eventName].data.hasOwnProperty('element')) {
                        throw new Error('Reserved data property name "element"');
                    }
                    
                    //TODO data.cell ?
                    var data = {'element': element};
                    for(var key in events[eventName].data) {
                        data[key] = events[eventName].data[key];
                    }


                    var customEvent = new CustomEvent(customEventName, {'detail': data, 'bubbles': true});

                    element.addEventListener(eventName, function () {
                        that.dispatchEvent(customEvent);
                    });
                });
            },
            getThColumnHeader: function getColumnHeaderTdWidth(colIndex) {
                return this.columnHeaderWrapper.querySelector("tr:nth-child(1) th:nth-child(" + colIndex + ")");
            },
            getCellAt: function getCellAt(xCoord, yCoord) {
                return this.contentWrapper.querySelector("table tr:nth-child("+(yCoord-this.firstRowCreate+1)+") td:nth-child(" + (xCoord+1) + ")");
            }
        }
    });

    //Recuperation de la taille de la scrollbar selon le navigateur
    function getScrollBarWidth() {
        var inner = document.createElement('p');
        inner.style.width = "100%";
        inner.style.height = "200px";

        var outer = document.createElement('div');
        outer.style.position = "absolute";
        outer.style.top = "0px";
        outer.style.left = "0px";
        outer.style.visibility = "hidden";
        outer.style.width = "200px";
        outer.style.height = "150px";
        outer.style.overflow = "hidden";
        outer.appendChild(inner);

        document.body.appendChild(outer);
        var w1 = inner.offsetWidth;
        outer.style.overflow = 'scroll';
        var w2 = inner.offsetWidth;
        if (w1 == w2) {
            w2 = outer.clientWidth;
        }
        document.body.removeChild(outer);
        return (w1 - w2);
    }

    function getTrHeight() {
        var table = document.createElement("table");
        table.style.visibility = "hidden";
        var tr = document.createElement("tr");
        tr.setAttribute('class', 'x-datagrid-tr');
        var td = document.createElement("td");
        td.setAttribute('class', 'x-datagrid-td');
        td.innerHTML = "<div class='x-datagrid-cell'>test</div>";
        tr.appendChild(td);
        table.appendChild(tr);
        document.body.appendChild(table);
        var trOffsetHeight = tr.offsetHeight;
        document.body.removeChild(table);
        if(trOffsetHeight === 0) {
            throw new Error('Erreur lors du calcul de la hauteur disponible pour une ligne');
        }
        return trOffsetHeight;
    }

})();

// cellClass utilisé pour le td
// class utilisé pour la div dans le td
function Cell(obj) {
    "use strict";
    this.value = obj.value || "";
    this.cellClass = obj.cellClass || "";
    this.errorMessage = obj.errorMessage || "";
    this.events = obj.events || null;
    if(obj.class && !Array.isArray(obj.class)) {
        throw new Error('class on cell is an array');
    }
    this.rowspan = obj.rowspan || 0;
    this.colspan = obj.colspan || 0;
    this.class = obj.class || [];
    this.rowIndex = obj.rowIndex || null; //TODO A utiiser en remplacement du td.cellRow
    this.columnIndex = obj.columnIndex || null; //TODO Non utilisé pour le moment
}
module.exports = {'Cell': Cell};
