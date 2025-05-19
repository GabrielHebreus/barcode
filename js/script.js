const { jsPDF } = window.jspdf;

document
  .getElementById("generateBtn")
  .addEventListener("click", generateBarcodes);
document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);

function calculateEAN13CheckDigit(code) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  let remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

function generateEAN13Sequence(quantity) {
  const codes = [];
  let base = 789123456000; // base fictícia válida
  for (let i = 0; i < quantity; i++) {
    let partial = (base + i).toString().padStart(12, "0");
    let fullCode = partial + calculateEAN13CheckDigit(partial);
    codes.push(fullCode);
  }
  return codes;
}

// Gera sequencia simples para outros tipos só incrementando números, comprimento variável
function generateGenericSequence(quantity, length) {
  const codes = [];
  let base = 1000000000;
  for (let i = 0; i < quantity; i++) {
    let code = (base + i).toString();
    if (code.length > length) {
      code = code.slice(-length);
    } else {
      code = code.padStart(length, "0");
    }
    codes.push(code);
  }
  return codes;
}

function generateBarcodes() {
  const output = document.getElementById("output");
  const errorMessage = document.getElementById("errorMessage");
  output.innerHTML = "";
  errorMessage.textContent = "";

  const type = document.getElementById("barcodeType").value;
  const quantityInput = document.getElementById("quantityInput").value;
  const quantity = quantityInput ? parseInt(quantityInput) : 0;
  const manualInput = document.getElementById("codesInput").value.trim();

  let codes = [];

  if (manualInput) {
    codes = manualInput
      .split(/\n|,/)
      .map((c) => c.trim())
      .filter((c) => c);
  }

  if (!manualInput && quantity > 0) {
    if (type === "EAN13") {
      codes = generateEAN13Sequence(quantity);
    } else {
      // outros tipos geram sequencia com tamanho baseado no tipo
      let length = 12;
      if (type === "CODE128") length = 12;
      else if (type === "CODE39") length = 10;
      else if (type === "UPC") length = 12;
      else if (type === "ITF") length = 14;

      codes = generateGenericSequence(quantity, length);
    }
  }

  if (codes.length === 0) {
    errorMessage.textContent =
      "Informe os códigos manualmente ou uma quantidade para gerar.";
    return;
  }

  codes.forEach((code) => {
    const div = document.createElement("div");
    div.className = "barcode-card";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("barcode-svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "180");
    svg.setAttribute("height", "80");

    try {
      JsBarcode(svg, code, {
        format: type,
        lineColor: "#34495e",
        width: 1.2,
        height: 18.29,
        displayValue: false,
        fontSize: 14,
        margin: 0,
      });
      div.appendChild(svg);

      const btnDownload = document.createElement("button");
      btnDownload.className = "download-btn";
      btnDownload.textContent = "Baixar PNG";
      btnDownload.onclick = () => downloadPNG(svg, code);
      div.appendChild(btnDownload);

      output.appendChild(div);
    } catch (e) {
      errorMessage.textContent = `Erro ao gerar o código: ${code}`;
    }
  });
}

function downloadPNG(svg, code) {
  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    URL.revokeObjectURL(url);
    const pngFile = canvas.toDataURL("image/png");

    const a = document.createElement("a");
    a.download = code + ".png";
    a.href = pngFile;
    a.click();
  };
  img.src = url;
}

async function exportPDF() {
  const output = document.getElementById("output");
  const barcodeCards = output.querySelectorAll(".barcode-card");

  if (barcodeCards.length === 0) {
    alert("Nenhum código gerado para exportar.");
    return;
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 10; // margem da página
  const cardWidth = 19.5; // largura em mm
  const cardHeight = 8; // altura em mm
  const spacingX = 5; // espaço horizontal entre os cards
  const spacingY = 5; // espaço vertical entre os cards

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const cols = Math.floor(
    (pageWidth - margin * 2 + spacingX) / (cardWidth + spacingX)
  );
  const rows = Math.floor(
    (pageHeight - margin * 2 + spacingY) / (cardHeight + spacingY)
  );

  let x = margin;
  let y = margin;
  let colCount = 0;
  let rowCount = 0;

  for (const card of barcodeCards) {
    const svg = card.querySelector("svg");
    if (!svg) continue;

    const svgString = new XMLSerializer().serializeToString(svg);
    const imgURI = await svgStringToImage(svgString);

    if (imgURI) {
      pdf.addImage(imgURI, "PNG", x, y, cardWidth, cardHeight); // 1. Desenha uma borda (linha de corte) ao redor do card
      pdf.setDrawColor(150); // cor cinza claro
      pdf.setLineWidth(0.2); // espessura da linha de corte
      pdf.rect(x - 1, y - 1, cardWidth + 2, cardHeight + 2); // desenha o retângulo

      // 2. Adiciona a imagem do código de barras
      pdf.addImage(imgURI, "PNG", x, y, cardWidth, cardHeight);

      // Texto abaixo do código (opcional)
      const codeText =
        card.querySelector("svg").getAttribute("data-code") || "";
      pdf.setFontSize(6);
      pdf.text(codeText, x + cardWidth / 2, y + cardHeight + 3, {
        align: "center",
      });
    }

    colCount++;
    if (colCount >= cols) {
      colCount = 0;
      x = margin;
      rowCount++;
      if (rowCount >= rows) {
        pdf.addPage();
        y = margin;
        rowCount = 0;
      } else {
        y += cardHeight + spacingY;
      }
    } else {
      x += cardWidth + spacingX;
    }
  }

  pdf.save("codigos_de_barras.pdf");
}

function svgStringToImage(svgString) {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      resolve(null);
    };

    img.src = url;
  });
}
