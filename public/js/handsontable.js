function buildTable(tableData) {
  var container = document.getElementById("handsontable");
  // if table already exist, let's destroy it!!!!!
  if (hot) {
    hot.destroy();
  }

  hot = new Handsontable(container, {
    data: tableData,
    filters: true,
    dropdownMenu: true,
    columnSorting: true,
    stretchH: "all",
    rowHeaders: true,
    colHeaders: Object.keys(tableData[0]),
    height: 1200,
    search: true,
    renderer: function (instance, td, row, col, prop, value, cellProperties) {
      Handsontable.renderers.TextRenderer.apply(this, arguments);
      td.innerHTML = `<div class="truncated">${value}</div>`;
    },
    renderAllRows: false,
    licenseKey: "non-commercial-and-evaluation", // for non-commercial use only
  });

  width = document.body.clientWidth;
  height = document.body.clientHeight;
  hot.updateSettings({ width: width * 0.75 });

  hot.selectCell(0, 0);

  var exportFile = document.getElementById("export-file");
  var exportPlugin = hot.getPlugin("exportFile");

  exportFile.addEventListener("click", function () {
    exportPlugin.downloadFile("csv", {
      bom: false,
      columnDelimiter: ",",
      columnHeaders: true,
      exportHiddenColumns: true,
      exportHiddenRows: true,
      fileExtension: "csv",
      filename: "CUCM-SQL-RESULTS_[YYYY]-[MM]-[DD]",
      mimeType: "text/csv",
      rowDelimiter: "\r\n",
      rowHeaders: false,
    });
  });

  const searchField = document.querySelector("#searchField");
  // add a search input listener
  searchField.addEventListener("keyup", function (event) {
    // get the `Search` plugin's instance
    const search = hot.getPlugin("search");
    // use the `Search` plugin's `query()` method
    const queryResult = search.query(event.target.value);
    // Return results to UI so user can select where to go
    hot.render();
  });
}
