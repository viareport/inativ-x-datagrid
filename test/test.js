var TestSuite = require('spatester');
var rootSelector = "#datagrid";
var filterInputSelector = rootSelector + " x-inputfilter input";
var datagrid;

var testSuite = new TestSuite("Datagrid test", {
    setUp: function () {
        datagrid = document.createElement('x-datagrid');
        datagrid.setAttribute('id', "datagrid");
        datagrid.setAttribute('cell-height', 20);
        datagrid.setAttribute('cell-width', 100);
        datagrid.setAttribute('filter', false);

        document.querySelector('body').appendChild(datagrid);

        datagrid.data = {
            colHeader: [
                [
                    {value: 'column1', filter: true},
                    {value: 'column2'},
                    {value: 'column3'}
                ]
            ],
            content: [
                [
                    {value: "A1"},
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
            ]
        };
    },

    tearDown: function () {
        var datagrid = document.querySelector('x-datagrid');
        document.body.removeChild(datagrid);
    }
});

testSuite.addTest("Affichage de la grille", function (scenario, asserter) {
    //"Le tableau doit contenir 3 column headers"
    asserter.expect("th").to.have.nodeLength(3);

    // "Le tableau doit contenir 9 cellules de contenu"
    asserter.expect(".x-datagrid-td").to.have.nodeLength(9);

    asserter.assertTrue(function () {
        var cell = datagrid.getCellAt(1,2);
        return cell.textContent === "B3";
    }, "La cellule de coordonnées 1,2 doit contenir 'B3'");
});

testSuite.addTest("Application d'un filtre", function (scenario, asserter) {
    scenario
        .fill(filterInputSelector, 'A1')
        .keyboard(filterInputSelector, "keyup", "Enter", 13);

    //"Après filtre, le tableau doit contenir 3 cellules de contenu"
    asserter.expect(".x-datagrid-td").to.have.nodeLength(3);
});

testSuite.addTest("Visualisation d'erreur dans la grille", function (scenario, asserter) {
    scenario.exec(function () {
        datagrid.content = [
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
        datagrid.content = [
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
        datagrid.content = [
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

document.addEventListener('DOMComponentsLoaded', function () {
    testSuite.run();
});