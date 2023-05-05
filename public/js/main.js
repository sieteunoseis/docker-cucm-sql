// Define static variables for use across functions
var hot;
var codeEditor;

// Body Load Functions
document.addEventListener(
  "DOMContentLoaded",
  function () {
    console.log("Page Loaded");

    // Define CodeMirror Settings
    codeEditor = CodeMirror.fromTextArea(codeArea, {
      theme: "monokai",
      lineNumbers: true,
      tabSize: 0,
      lineWrapping: true,
      mode: "text/x-sql",
    });

    // Update CodeMirror size based on window
    width = document.body.clientWidth;
    height = document.body.clientHeight;
  
    if(width > 1200){
      codeEditor.setSize(1000, 400);
    } else {  
      codeEditor.setSize(width * 0.75, 400);
    }

    // Update dropdown
    updateSelect();

    // Update handsontable width with window size
    if (hot) {
      if(width > 1200){
        hot.updateSettings({ width: '1000px' });
      } else {
        hot.updateSettings({ width: width * 0.75 });
      }
    }

    // Register the tool tip buttons
    $('[data-bs-toggle="tooltip"]').tooltip({
      trigger: "hover",
    });
  },
  false
);

function load() {
  var fileName = document.getElementById("selectQuery").value;
  if (fileName === "Load SQL Query") {
    showAlert("Error", "Please select a query first!");
  } else {
    fetch("/getquery/" + fileName, {
      method: "GET",
    })
      .then((response) => response.json())
      .then((results) => {
        document.getElementById("sqlTitle").value = results.fileName.replace(
          /\.[^/.]+$/,
          ""
        );
        codeEditor.setValue(results.data);
      })
      .catch((err) => console.log(err));
  }
}

loadButton.addEventListener("click", load);

function clear() {
  document.getElementById("sqlTitle").value = "";
  codeEditor.setValue("");
}

clearButton.addEventListener("click", clear);

function saveQuery() {
  query = codeEditor.getValue().trim();
  fileName = document.getElementById("sqlTitle").value;

  // let's check if they added 'run sql'
  var re = new RegExp("^(run sql)", "i");
  var match = re.test(query);

  if (query && fileName && !match) {
    var data = {
      query: query,
      fileName: fileName,
    };

    fetch("/savequery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.text())
      .then((body) => {
        $("#saveModal").modal("toggle");
        showAlert("Success", "Succesfully saved SQL Query!");
        updateSelect();
      })
      .catch((err) => console.log(err));
  } else {
    $("#saveModal").modal("toggle");
    if(match){
      showAlert("Error", "Please remove 'run sql' from statement");
    }else{
      showAlert("Error", "Missing: Query and/or Query Name");
    }
  }
}

saveButton.addEventListener("click", saveQuery);

async function runQuery() {
  // Get query from CodeMirror Editor
  query = codeEditor.getValue();
  // let's check if they added 'run sql'
  var re = new RegExp("^(run sql)", "i");
  var match = re.test(query);

  if (query && !match) {
    // Let's show the container holding the results
    $("#resultsContainer").collapse("show");
    // if handsontable already exists, let's add a spinner until a new one can be rendered
    if (hot) {
      $("#spinnerContainer").removeClass("d-none");
      $("#tableContainer").addClass("d-none");
    }
    // Clean up query. Remove any comments before sending to server
    var cleanedQuery = query
      .replace(/(\/\*[^*]*\*\/)|(\/\/[^*]*)|(--[^.].*)/gm, "")
      .replace(/^\s+/gm, "")
      .replace(/^\s*\n/gm, "");

    var data = {
      query: cleanedQuery,
    };

    let obj;

    const res = await fetch("/getdata", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (res.status === 204) {
      // Let's hide the container holding the results
      $("#resultsContainer").collapse("hide");
      // Display alert
      showAlert("Error", "No results returned.");
    } else {
      obj = await res.json();

      // 500 error, else 200 OK
      if (obj?.faultcode || obj?.code === "ECONNRESET") {
        var fault = obj?.faultstring || obj?.code;
        // Let's hide the container holding the results
        $("#resultsContainer").collapse("hide");
        // Display alert
        showAlert("Error", fault);
      } else {
        $("#spinnerContainer").addClass("d-none");
        $("#tableContainer").removeClass("d-none");
        buildTable(obj.row);
      }
    }
  } else {
    if (match) {
      showAlert("Error", "Please remove 'run sql' from statement");
    } else {
      showAlert("Error", "Please enter a query first");
    }
  }
}

runButton.addEventListener("click", runQuery);

function formatEditor() {
  var query = codeEditor.getValue().trim();
  var formattedQuery = sqlFormatter.format(query, {
    language: "spark",
    keywordCase: "upper",
    linesBetweenQueries: 2,
  });
  codeEditor.setValue(formattedQuery);
}

formatButton.addEventListener("click", formatEditor);

function updateSelect() {
  // Get files for drop down
  fetch("/getfiles", {
    method: "GET",
  })
    .then((response) => response.json())
    .then((body) => {
      var options = body.map((e) => {
        return `<option value="${e}">${e}</option>`;
      });
      document.getElementById("selectQuery").innerHTML = options;
    })
    .catch((err) => console.log(err));
}

var onresize = function () {
  width = document.body.clientWidth;
  height = document.body.clientHeight;

  if(width > 1200){
    codeEditor.setSize(1000, 400);
  } else {  
    codeEditor.setSize(width * 0.75, 400);
  }

  if (hot) {
    if(width > 1200){
      hot.updateSettings({ width: '1000px' });
    } else {
      hot.updateSettings({ width: width * 0.75 });
    }
  }
};

window.addEventListener("resize", onresize);

$("#searchModal").on("shown.bs.modal", function () {
  $("#searchField").focus();
});

$("#saveModal").on("shown.bs.modal", function () {
  $("#sqlTitle").focus();
});

function showAlert(messageTitle, messageBody) {
  const toast = document.querySelector(".toast");
  const progress = document.querySelector(".progress");
  const messageTitleSpan = document.getElementById("text-1");
  const messageBodySpan = document.getElementById("text-2");
  const iconHolderDiv = document.getElementById("iconHolder");

  messageTitleSpan.innerHTML = messageTitle;
  messageBodySpan.innerHTML = messageBody;

  switch (messageTitle) {
    case "Success":
      iconHolderDiv.innerHTML = '<i class="fas fa-solid fa-check check"></i>';
      break;
    case "Error":
      iconHolderDiv.innerHTML =
        '<i class="fa-solid fa-circle-exclamation fa-beat error"></i>';
      break;
  }

  let timer1, timer2;

  toast.classList.add("active");
  progress.classList.add("active");

  timer1 = setTimeout(() => {
    toast.classList.remove("active");
  }, 5000); //1s = 1000 milliseconds

  timer2 = setTimeout(() => {
    progress.classList.remove("active");
  }, 5300);

  closeAlert.addEventListener("click", () => {
    console.log("Clicked");
    toast.classList.remove("active");

    setTimeout(() => {
      progress.classList.remove("active");
    }, 300);

    clearTimeout(timer1);
    clearTimeout(timer2);
  });
}
