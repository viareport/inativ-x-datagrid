var TestSuite = require('spatester');
var Column = require('../src/main').Column;
var rootSelector = "#datagrid";
var filterInputSelector = rootSelector + " x-inputfilter input";
var datagrid;

var testSuite = new TestSuite("Datagrid test", {
    setUp: function () {
        datagrid = document.createElement('x-datagrid');
        datagrid.setAttribute('id', 'datagrid');
        datagrid.setAttribute('cell-width', 100);

        document.querySelector('body').appendChild(datagrid);

        var _content = [];

        for(var i =1; i<=3000; i++) {
            _content.push([
                {value: "A"+i},
                {value: "B"+i},
                {value: "C"+i},
            ]);
        }
        _content.push([
            {value: ""}, //pour le test de filtre sur les input vides
            {value: "B3001"},
            {value: "C3001"},
        ]);

        datagrid.columnModel = [
        	{value: 'column1'},
            {value: 'column2'},
            {value: 'column3'}
        ];

        datagrid.gridModel = _content;
    },

    tearDown: function () {
        var datagrid = document.querySelector('x-datagrid');
        document.body.removeChild(datagrid);
    }
});

testSuite.addTest("Affichage de la grille", function (scenario, asserter) {
    //"Le tableau doit contenir 3 column headers"
    asserter.expect("th").to.have.nodeLength(3);

    asserter.assertTrue(function () {
        var cell = datagrid.getCellAt(1,2);
        return cell.textContent === "B3";
    }, "La cellule de coordonnées 1,2 doit contenir 'B3'");
});


function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function defaultFilterFunction(element, filterValue) {
    var regexpText;
    if (filterValue.indexOf("*") === 0){ // c'est le cas du finit par ou contient
        if (filterValue.lastIndexOf("*") === filterValue.length - 1 ){
            regexpText = escapeRegExp(filterValue).replace(/\\\*/g, ".*");
        } else {
            regexpText = escapeRegExp(filterValue).replace(/\\\*/g, "")+"$";
        }
    } else { //commence
        regexpText = "^" + escapeRegExp(filterValue).replace(/\\\*/g, ".*"); //  on applique la regle "commence par"
    }

    var regex = new RegExp(regexpText, "i");
    if (regex.test(" ") && (element === null || element.length === 0)) { // un espace dans le filtre signifie qu'on veut recuperer toutes les cellules vides
        return true;
    } else {
        return regex.test(element);
    }
}

function FilterableDatagridModel(content) {
    this.content = content;
    this.filteredContent = content;
    this.filters = [];
}
FilterableDatagridModel.prototype.getLength = function() {
    return this.filteredContent.length;
};
FilterableDatagridModel.prototype.getRow = function(rowIndex) {
    return this.filteredContent[rowIndex];
};
FilterableDatagridModel.prototype.filter = function(filterEvent) {
    if (filterEvent.detail.filterValue === undefined || filterEvent.detail.filterValue === "") {
        delete this.filters[filterEvent.detail.filterType];
    } else {
        this.filters[filterEvent.detail.filterType] = filterEvent.detail.filterValue;
    }
    this.filteredContent = this.content;
    for (var columnIndex in this.filters) {
        var filterQuery = this.filters[columnIndex],
            column = this.grid.columnModel.getColumns()[columnIndex];
        this.filteredContent = this.filteredContent.filter(function (row) {
            var elem = this.grid.columnModel.getCell(row, column),
                filterFn = column.filterFn || defaultFilterFunction,
                isIncluded = filterFn(elem.value, filterQuery);
            return isIncluded;
        }.bind(this));
    }

    //FIXME mettre ça dans une méthode du datagrid ?
    datagrid.lastCurrentRow = 0;
    datagrid.contentWrapper.scrollTop = 0;
    datagrid.dispatchEvent(new CustomEvent('contentUpdated'));
};

function FilterableColumnModel(columns) {
    this.columns = columns; // bof (perte de fonctionnalité par rapport au DefaultColumnModel)
}
FilterableColumnModel.prototype.getColumns = function() {
    return this.columns;
};
FilterableColumnModel.prototype.renderHeader = function renderHeader(tr) {
    this.getColumns().forEach(function(col) {
        var th = document.createElement('th');
        if (col.width) {
            th.style.width = col.width + 'px';
        }
        th.innerHTML = '<div class="x-datagrid-cell">' + col.value + '</div>';

        if (col.filter) {
            var filter = document.createElement('x-inputfilter');
            if (col.defaultFilter) {
                filter.setAttribute('defaultFilter', col.defaultFilter);
                this.grid.gridModel.filters[col.index] = col.defaultFilter;
            }
            filter.setAttribute('filterType', col.index);
            th.appendChild(filter);
        }
        tr.appendChild(th);
    });
};
FilterableColumnModel.prototype.getCell = function(row, column) {
    return row[column.index];
};

testSuite.addTest("Application d'un filtre", function (scenario, asserter) {
    scenario.exec(function() {
        var columns = datagrid.getColumns();
        columns[0].filter = true; //beurk (on ajoute l'attribut filter comme des gros)
        datagrid.addEventListener('filter', function(e) {
            datagrid.gridModel.filter(e);
        });
        datagrid.columnModel = new FilterableColumnModel(columns);
        datagrid.gridModel = new FilterableDatagridModel(datagrid.getContent());
    });
    scenario
        .fill(filterInputSelector, 'A3000')
        .keyboard(filterInputSelector, "keyup", "Enter", 13);

    //"Après filtre, le tableau doit contenir 3 cellules de contenu"
    asserter.expect(".x-datagrid-td").to.have.nodeLength(3);
});

testSuite.addTest("Application d'un filtre avec un espace = on veut récupérer toutes les cellules vides", function (scenario, asserter) {
	scenario.exec(function() { // et rebeurk
        var columns = datagrid.getColumns();
        columns[0].filter = true; //beurk (on ajoute l'attribut filter comme des gros)
        datagrid.addEventListener('filter', function(e) {
            datagrid.gridModel.filter(e);
        });
        datagrid.columnModel = new FilterableColumnModel(columns);
        datagrid.gridModel = new FilterableDatagridModel(datagrid.getContent());
    });    
	scenario
        .fill(filterInputSelector, ' ')
        .keyboard(filterInputSelector, "keyup", "Enter", 13);

    //"Après filtre, le tableau doit contenir 3 cellules de contenu"
    asserter.expect(".x-datagrid-td").to.have.nodeLength(3);
});

testSuite.addTest("Visualisation d'erreur dans la grille", function (scenario, asserter) {
    scenario.exec(function () {
        datagrid.columnModel.getColumns()[0].renderer = function(tdContentWrapper, cell, row, column) {
            if (cell.errorMessage) {
                var td = tdContentWrapper.parentNode,
                    errorWrapper = document.createElement('span');
                errorWrapper.className = 'error-message';
                errorWrapper.innerHTML = cell.errorMessage;
                td.insertBefore(errorWrapper, td.firstChild);
            }
            tdContentWrapper.innerHTML = cell.value;
        };
        datagrid.gridModel = [
            [
                {value: "A1", errorMessage: "ceci est un message d'erreur"},
                {value: "B1"},
                {value: "C1"}
            ],
            [
                {value: "A2"},
                {value: "B2"},
                {value: "C2"}
            ],
            [
                {value: "A3"},
                {value: "B3"},
                {value: "C3"}
            ]
        ];
    });

    // "Le tableau doit contenir une zone d'erreur et seulement une"
    asserter.expect(".error-message").to.exist();
    asserter.expect(".error-message").to.have.nodeLength(1);

    // "La cellule de la ligne 1 et colonne 1 doit indiquer une erreur"
    asserter.expect("x-datagrid .contentWrapper tr:nth-child(1) td:nth-child(1) span.error-message").to.exist();
});

testSuite.addTest("onContentRendered est appellé sur les plugins lors d'un repaint", function (scenario, asserter) {

    // Given

    var plugin = {
        onContentRenderedCalled: 0,
        onContentRendered: function() {
            this.onContentRenderedCalled++;
        },
        append: function() {

        }
    };

    var pluginSansOnContentRendered = {
        append: function() {

        }
    };

    scenario.exec(function () {
        datagrid.gridModel = [
            [
                {value: "A1"},
                {value: "B1"},
                {value: "C1"}
            ],
            [
                {value: "A2"},
                {value: "B2"},
                {value: "C2"}
            ]
        ];

        datagrid.registerPlugin(plugin);
        datagrid.registerPlugin(pluginSansOnContentRendered);
    });

    // When

    scenario.exec(function () {
        datagrid.gridModel = [
            [
                {value: "A1"},
                {value: "B1"},
                {value: "C1bis"}
            ],
            [
                {value: "A2"},
                {value: "B2"},
                {value: "C2"}
            ]
        ];
    });

    // Then

    asserter.assertTrue(function() {
        return plugin.onContentRenderedCalled === 1;
    }, "La méthode onContentRendered du plugin doit être appellée une fois");
});

testSuite.addTest("makeCellVisible rend la cellule visible", function (scenario, asserter) {

    // Given
    asserter.expect(".contentWrapper").not.to.have.html("C1499");

    // When
    scenario.exec(function() {
        datagrid.makeCellVisible(1500, 2);
    });

    // Then

    scenario.wait(function() {
        return (/C1499/).test(document.querySelector(".contentWrapper").innerHTML);
    });

    asserter.expect(".contentWrapper").to.have.html("C1499");
});

testSuite.addTest("makeCellVisible rend la cellule visible même lorsque l'on est au milieu du tableau", function (scenario, asserter) {

    // Given
    scenario.exec(function() {
        datagrid.makeCellVisible(1500, 2);
    });
    scenario.wait(function() {
        return (/C1499/).test(document.querySelector(".contentWrapper").innerHTML);
    });

    // When
    scenario.exec(function() {
        datagrid.makeCellVisible(30, 2);
    });

    // Then
    scenario.wait(function() {
        return (/C29/).test(document.querySelector(".contentWrapper").innerHTML);
    });
    asserter.expect(".contentWrapper").to.have.html("C29");
});

testSuite.addTest("makeCellVisible fonctionne lorsqu'il n'y a qu'une ligne dans le tableau", function (scenario, asserter) {

    // Given
    scenario.exec(function() {
        datagrid.gridModel = [
            [
                {value: "A1499"},
                {value: "B1499"},
                {value: "C1499"}
            ]
        ];
    });
    scenario.wait(function() {
        return (/C1499/).test(document.querySelector(".contentWrapper").innerHTML);
    });

    // When
    scenario.exec(function() {
        datagrid.makeCellVisible(0,0);
    });

    // Then
    asserter.expect(".contentWrapper").to.have.html("C1499");
});

document.addEventListener('DOMComponentsLoaded', function () {
    testSuite.run();
});