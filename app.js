// Dashboard Controller with CSV Upload Functionality
class DashboardController {
	constructor() {
		this.file1Data = null;
		this.file2Data = null;
		this.processedData = [];
		this.filteredData = [];
		this.currentChart = null;
		this.sortState = { column: "", direction: "asc" };
		this.indicators = [
			"Capital Social",
			"Carteira Credito",
			"Associados",
			"RDC LCA",
			"Poupança",
		];
		this.currencyIndicators = [
			"Capital Social",
			"Carteira Credito",
			"RDC LCA",
			"Poupança",
		];
		this.indicatorCheckboxMap = {
			"Capital Social": "capitalSocial",
			"Carteira Credito": "carteiraCredito",
			Associados: "associados",
			"RDC LCA": "rdcLca",
			Poupança: "poupanca",
		};
		this.tableIndicatorCheckboxMap = {
			"Capital Social": "tableCapitalSocial",
			"Carteira Credito": "tableCarteiraCredito",
			Associados: "tableAssociados",
			"RDC LCA": "tableRdcLca",
			Poupança: "tablePoupanca",
		};
		this.tableFilters = { gerente: "", agencia: "" };
		this.tableFilteredData = [];
		this.expectedColumns = [
			"Agência",
			"Gerente de Negócios",
			...this.indicators,
		];

		this.init();
	}

	init() {
		this.setupEventListeners();
		this.initializeButtonState();
	}

	initializeButtonState() {
		// Ensure the process button starts disabled
		const processButton = document.getElementById("processFiles");
		processButton.disabled = true;
		processButton.classList.remove("btn--primary");
		processButton.classList.add("btn--outline");
	}

	setupEventListeners() {
		// File upload listeners
		document
			.getElementById("file1")
			.addEventListener("change", (e) => this.handleFileSelect(e, 1));
		document
			.getElementById("file2")
			.addEventListener("change", (e) => this.handleFileSelect(e, 2));
		document
			.getElementById("processFiles")
			.addEventListener("click", (e) => this.handleProcessClick(e));
		document
			.getElementById("newUpload")
			.addEventListener("click", () => this.resetUpload());

		// Dashboard listeners (setup but not active initially)
		this.setupDashboardListeners();
	}

	setupDashboardListeners() {
		// Filtros
		document
			.getElementById("gerenteSelect")
			.addEventListener("change", () => this.applyFilters());
		document
			.getElementById("agenciaSelect")
			.addEventListener("change", () => this.applyFilters());

		// Checkboxes dos indicadores
		Object.values(this.indicatorCheckboxMap).forEach((id) => {
			document
				.getElementById(id)
				.addEventListener("change", () => this.applyFilters());
		});

		// Limpar filtros
		document
			.getElementById("clearFilters")
			.addEventListener("click", () => this.clearFilters());

		// Filtros específicos da tabela
		const tableGerenteSelect = document.getElementById("tableGerenteSelect");
		if (tableGerenteSelect) {
			tableGerenteSelect.addEventListener("change", () =>
				this.applyTableFilters(),
			);
		}

		const tableAgenciaSelect = document.getElementById("tableAgenciaSelect");
		if (tableAgenciaSelect) {
			tableAgenciaSelect.addEventListener("change", () =>
				this.applyTableFilters(),
			);
		}

		Object.values(this.tableIndicatorCheckboxMap).forEach((id) => {
			const checkbox = document.getElementById(id);
			if (checkbox) {
				checkbox.addEventListener("change", () => {
					if (!this.ensureTableIndicatorSelection()) {
						checkbox.checked = true;
					}
					this.renderTable();
				});
			}
		});

		const clearTableFilters = document.getElementById("clearTableFilters");
		if (clearTableFilters) {
			clearTableFilters.addEventListener("click", (event) => {
				event.preventDefault();
				this.clearTableFilters();
			});
		}

		// Ordenação da tabela (delegação para suportar cabeçalho dinâmico)
		const tableHead = document.getElementById("tableHead");
		if (tableHead) {
			tableHead.addEventListener("click", (event) => {
				const header = event.target.closest("th[data-sort]");
				if (header) {
					this.sortTable(header.dataset.sort);
				}
			});
		}
	}

	handleProcessClick(event) {
		// Only process if both files are loaded and button is not disabled
		if (!this.file1Data || !this.file2Data) {
			event.preventDefault();
			return false;
		}
		this.processFiles();
	}

	handleFileSelect(event, fileNumber) {
		const file = event.target.files[0];
		const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
		const label = document.querySelector(`label[for="file${fileNumber}"]`);

		if (!file) {
			this.resetFileInfo(fileNumber);
			return;
		}

		// Validate file type
		if (!file.name.toLowerCase().endsWith(".csv")) {
			this.showFileError(
				fileNumber,
				"Por favor, selecione apenas arquivos .csv",
			);
			return;
		}

		// Show file info
		this.showFileSuccess(fileNumber, file);

		// Read and parse CSV
		this.readCSVFile(file, fileNumber);
	}

	readCSVFile(file, fileNumber) {
		const reader = new FileReader();

		reader.onload = (e) => {
			try {
				const csvData = this.parseCSV(e.target.result);

				if (this.validateCSVData(csvData, fileNumber)) {
					if (fileNumber === 1) {
						this.file1Data = csvData;
					} else {
						this.file2Data = csvData;
					}

					this.checkProcessButton();
				}
			} catch (error) {
				this.showFileError(
					fileNumber,
					"Erro ao processar arquivo: " + error.message,
				);
			}
		};

		reader.onerror = () => {
			this.showFileError(fileNumber, "Erro ao ler o arquivo");
		};

		reader.readAsText(file, "UTF-8");
	}

	parseCSV(csvText) {
		const lines = csvText.split("\n").filter((line) => line.trim());
		if (lines.length < 2) {
			throw new Error(
				"Arquivo CSV deve ter pelo menos 2 linhas (cabeçalho + dados)",
			);
		}

		const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
		const rows = [];

		for (let i = 1; i < lines.length; i++) {
			const values = this.parseCSVLine(lines[i]);
			if (values.length === headers.length) {
				const row = {};
				headers.forEach((header, index) => {
					let value = values[index];

					// Convert numeric values
					if (this.isNumericColumn(header)) {
						value = this.parseNumericValue(value);
					}

					row[header] = value;
				});
				rows.push(row);
			}
		}

		return { headers, rows };
	}

	parseCSVLine(line) {
		const values = [];
		let current = "";
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === "," && !inQuotes) {
				values.push(current.trim().replace(/"/g, ""));
				current = "";
			} else {
				current += char;
			}
		}

		values.push(current.trim().replace(/"/g, ""));
		return values;
	}

	isNumericColumn(columnName) {
		return this.indicators.includes(columnName);
	}

	parseNumericValue(value) {
		if (!value || value === "") return 0;

		// Remove currency symbols and spaces
		const cleanValue = value
			.toString()
			.replace(/[R$\s]/g, "")
			.replace(/\./g, "") // Remove thousands separator
			.replace(",", "."); // Replace decimal comma with dot

		const parsed = parseFloat(cleanValue);
		return isNaN(parsed) ? 0 : parsed;
	}

	validateCSVData(csvData, fileNumber) {
		const { headers, rows } = csvData;

		// Check required columns
		const missingColumns = this.expectedColumns.filter(
			(col) => !headers.includes(col),
		);

		if (missingColumns.length > 0) {
			this.showFileError(
				fileNumber,
				`Colunas obrigatórias ausentes: ${missingColumns.join(", ")}`,
			);
			return false;
		}

		if (rows.length === 0) {
			this.showFileError(fileNumber, "Arquivo não contém dados válidos");
			return false;
		}

		return true;
	}

	showFileSuccess(fileNumber, file) {
		const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
		const label = document.querySelector(`label[for="file${fileNumber}"]`);

		label.classList.remove("file-error");
		label.classList.add("file-selected");

		const sizeInKB = (file.size / 1024).toFixed(2);

		fileInfo.innerHTML = `
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${sizeInKB} KB</div>
                <div class="file-status success">✓ Arquivo válido</div>
            </div>
        `;
	}

	showFileError(fileNumber, message) {
		const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
		const label = document.querySelector(`label[for="file${fileNumber}"]`);

		label.classList.remove("file-selected");
		label.classList.add("file-error");

		fileInfo.innerHTML = `
            <div class="file-status error">✗ ${message}</div>
        `;

		// Reset file data
		if (fileNumber === 1) {
			this.file1Data = null;
		} else {
			this.file2Data = null;
		}

		this.checkProcessButton();
	}

	resetFileInfo(fileNumber) {
		const fileInfo = document.getElementById(`fileInfo${fileNumber}`);
		const label = document.querySelector(`label[for="file${fileNumber}"]`);

		label.classList.remove("file-selected", "file-error");
		fileInfo.innerHTML =
			'<div class="file-status">Nenhum arquivo selecionado</div>';

		if (fileNumber === 1) {
			this.file1Data = null;
		} else {
			this.file2Data = null;
		}

		this.checkProcessButton();
	}

	checkProcessButton() {
		const processButton = document.getElementById("processFiles");
		const canProcess = this.file1Data && this.file2Data;

		processButton.disabled = !canProcess;

		if (canProcess) {
			processButton.classList.remove("btn--outline");
			processButton.classList.add("btn--primary");
		} else {
			processButton.classList.remove("btn--primary");
			processButton.classList.add("btn--outline");
		}
	}

	async processFiles() {
		// Double check that we have both files before processing
		if (!this.file1Data || !this.file2Data) {
			return;
		}

		const processButton = document.getElementById("processFiles");
		const spinner = document.getElementById("loadingSpinner");
		const btnText = processButton.querySelector(".btn-text");
		const messagesDiv = document.getElementById("uploadMessages");

		// Show loading state
		processButton.disabled = true;
		spinner.classList.remove("hidden");
		btnText.textContent = "Processando...";

		try {
			// Simulate processing delay for better UX
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Process and compare data
			this.processDataComparison();

			// Show success message
			messagesDiv.innerHTML =
				'<div class="message success">✓ Arquivos processados com sucesso! Dashboard carregado.</div>';

			// Hide upload section and show dashboard
			setTimeout(() => {
				document.getElementById("uploadSection").classList.add("hidden");
				document.getElementById("dashboardContent").classList.remove("hidden");

				// Initialize dashboard
				this.initializeDashboard();
			}, 1500);
		} catch (error) {
			messagesDiv.innerHTML = `<div class="message error">✗ Erro ao processar arquivos: ${error.message}</div>`;
			console.error("Processing error:", error);
		} finally {
			// Reset button state
			spinner.classList.add("hidden");
			btnText.textContent = "Processar Arquivos";
			this.checkProcessButton(); // This will properly set the button state based on file availability
		}
	}

	processDataComparison() {
		const data1 = this.file1Data.rows;
		const data2 = this.file2Data.rows;

		this.processedData = [];

		// Create comparison data
		data1.forEach((item1) => {
			const key = `${item1["Gerente de Negócios"]}_${item1["Agência"]}`;
			const item2 = data2.find(
				(d) =>
					d["Gerente de Negócios"] === item1["Gerente de Negócios"] &&
					this.normalizeAgency(d["Agência"]) ===
						this.normalizeAgency(item1["Agência"]),
			);

			if (item2) {
				this.indicators.forEach((indicator) => {
					const value1 = item1[indicator] || 0;
					const value2 = item2[indicator] || 0;
					const diff = value2 - value1;
					const percentage = value1 !== 0 ? (diff / Math.abs(value1)) * 100 : 0;

					this.processedData.push({
						gerente: item1["Gerente de Negócios"],
						agencia: item1["Agência"],
						indicador: indicator,
						valor1: value1,
						valor2: value2,
						diferenca: diff,
						percentual: percentage,
					});
				});
			}
		});

		this.filteredData = [...this.processedData];
		this.tableFilteredData = [...this.processedData];
	}

	normalizeAgency(name) {
		return name ? name.trim().toLowerCase().replace(/\s+/g, " ") : "";
	}

	initializeDashboard() {
		this.populateFilters();
		this.populateTableFilters();
		this.applyFilters();
		this.applyTableFilters();
	}

	populateFilters() {
		const gerentes = [
			...new Set(this.processedData.map((item) => item.gerente)),
		].sort();
		const agencias = [
			...new Set(this.processedData.map((item) => item.agencia)),
		].sort();

		const gerenteSelect = document.getElementById("gerenteSelect");
		const agenciaSelect = document.getElementById("agenciaSelect");

		// Clear existing options (except first)
		gerenteSelect.innerHTML = '<option value="">Todos</option>';
		agenciaSelect.innerHTML = '<option value="">Todas</option>';

		gerentes.forEach((gerente) => {
			const option = document.createElement("option");
			option.value = gerente;
			option.textContent = gerente;
			gerenteSelect.appendChild(option);
		});

		agencias.forEach((agencia) => {
			const option = document.createElement("option");
			option.value = agencia;
			option.textContent = agencia;
			agenciaSelect.appendChild(option);
		});
	}

	populateTableFilters() {
		const gerentes = [
			...new Set(this.processedData.map((item) => item.gerente)),
		].sort();
		const agencias = [
			...new Set(this.processedData.map((item) => item.agencia)),
		].sort();

		const tableGerenteSelect = document.getElementById("tableGerenteSelect");
		const tableAgenciaSelect = document.getElementById("tableAgenciaSelect");

		if (!tableGerenteSelect || !tableAgenciaSelect) {
			return;
		}

		tableGerenteSelect.innerHTML = '<option value="">Todos</option>';
		tableAgenciaSelect.innerHTML = '<option value="">Todas</option>';

		gerentes.forEach((gerente) => {
			const option = document.createElement("option");
			option.value = gerente;
			option.textContent = gerente;
			tableGerenteSelect.appendChild(option);
		});

		agencias.forEach((agencia) => {
			const option = document.createElement("option");
			option.value = agencia;
			option.textContent = agencia;
			tableAgenciaSelect.appendChild(option);
		});
	}

	applyFilters() {
		const selectedGerente = document.getElementById("gerenteSelect").value;
		const selectedAgencia = document.getElementById("agenciaSelect").value;

		const indicatorSelection = {};
		this.indicators.forEach((indicator) => {
			const checkboxId = this.indicatorCheckboxMap[indicator];
			indicatorSelection[indicator] =
				document.getElementById(checkboxId).checked;
		});

		this.filteredData = this.processedData.filter((item) => {
			const gerenteMatch = !selectedGerente || item.gerente === selectedGerente;
			const agenciaMatch = !selectedAgencia || item.agencia === selectedAgencia;
			const indicatorMatch = indicatorSelection[item.indicador];

			return gerenteMatch && agenciaMatch && indicatorMatch;
		});

		this.renderChart();
		this.updateStats();
	}

	clearFilters() {
		document.getElementById("gerenteSelect").value = "";
		document.getElementById("agenciaSelect").value = "";

		Object.values(this.indicatorCheckboxMap).forEach((id) => {
			document.getElementById(id).checked = true;
		});

		this.applyFilters();
	}

	applyTableFilters() {
		const tableGerenteSelect = document.getElementById("tableGerenteSelect");
		const tableAgenciaSelect = document.getElementById("tableAgenciaSelect");

		const selectedGerente = tableGerenteSelect ? tableGerenteSelect.value : "";
		const selectedAgencia = tableAgenciaSelect ? tableAgenciaSelect.value : "";

		this.tableFilters = {
			gerente: selectedGerente,
			agencia: selectedAgencia,
		};

		this.tableFilteredData = this.processedData.filter((item) => {
			const gerenteMatch = !selectedGerente || item.gerente === selectedGerente;
			const agenciaMatch = !selectedAgencia || item.agencia === selectedAgencia;
			return gerenteMatch && agenciaMatch;
		});

		this.renderTable();
	}

	clearTableFilters() {
		const tableGerenteSelect = document.getElementById("tableGerenteSelect");
		const tableAgenciaSelect = document.getElementById("tableAgenciaSelect");

		if (tableGerenteSelect) {
			tableGerenteSelect.value = "";
		}

		if (tableAgenciaSelect) {
			tableAgenciaSelect.value = "";
		}

		Object.values(this.tableIndicatorCheckboxMap).forEach((id) => {
			const checkbox = document.getElementById(id);
			if (checkbox) {
				checkbox.checked = true;
			}
		});

		this.tableFilters = { gerente: "", agencia: "" };
		this.sortState = { column: "", direction: "asc" };

		this.applyTableFilters();
	}

	ensureTableIndicatorSelection() {
		return this.getActiveTableIndicators().length > 0;
	}

	formatCurrency(value) {
		return new Intl.NumberFormat("pt-BR", {
			style: "currency",
			currency: "BRL",
		}).format(value);
	}

	formatNumber(value) {
		return new Intl.NumberFormat("pt-BR").format(value);
	}

	formatPercentage(value) {
		return new Intl.NumberFormat("pt-BR", {
			style: "percent",
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value / 100);
	}

	getActiveTableIndicators() {
		return this.indicators.filter((indicator) => {
			const checkboxId = this.tableIndicatorCheckboxMap[indicator];
			const checkbox = document.getElementById(checkboxId);
			return checkbox ? checkbox.checked : true;
		});
	}

	formatDifference(value, isMonetary) {
		const absolute = Math.abs(value);
		const baseValue = isMonetary
			? this.formatCurrency(absolute)
			: this.formatNumber(absolute);
		if (value > 0) {
			return `+${baseValue}`;
		}
		if (value < 0) {
			return `-${baseValue}`;
		}
		return baseValue;
	}

	updateStats() {
		const data = this.filteredData;

		const gerentes = new Set(data.map((item) => item.gerente));
		const agencias = new Set(data.map((item) => item.agencia));

		document.getElementById("totalGerentes").textContent = gerentes.size;
		document.getElementById("totalAgencias").textContent = agencias.size;

		// Encontrar maiores variações
		const sortedByDiff = [...data].sort(
			(a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca),
		);
		const positives = sortedByDiff.filter((item) => item.diferenca > 0);
		const negatives = sortedByDiff.filter((item) => item.diferenca < 0);

		if (positives.length > 0) {
			document.getElementById("maiorPositiva").textContent =
				this.formatCurrency(positives[0].diferenca);
			document.getElementById("gerentePositiva").textContent =
				`${positives[0].gerente} - ${positives[0].indicador}`;
		} else {
			document.getElementById("maiorPositiva").textContent = "R$ 0";
			document.getElementById("gerentePositiva").textContent = "";
		}

		if (negatives.length > 0) {
			document.getElementById("maiorNegativa").textContent =
				this.formatCurrency(negatives[0].diferenca);
			document.getElementById("gerenteNegativa").textContent =
				`${negatives[0].gerente} - ${negatives[0].indicador}`;
		} else {
			document.getElementById("maiorNegativa").textContent = "R$ 0";
			document.getElementById("gerenteNegativa").textContent = "";
		}
	}

	renderTable() {
		const data = this.tableFilteredData;
		const tbody = document.getElementById("tableBody");
		const tableHead = document.getElementById("tableHead");
		const activeIndicators = this.getActiveTableIndicators();
		const columnCount = 1 + activeIndicators.length;

		if (
			typeof this.sortState.column === "string" &&
			this.sortState.column.startsWith("indicator:")
		) {
			const indicatorName = this.sortState.column.split(":")[1];
			if (!activeIndicators.includes(indicatorName)) {
				this.sortState.column = "agencia";
				this.sortState.direction = "asc";
			}
		}

		if (tableHead) {
			const headerCells = [
				{ key: "agencia", label: "Agência", className: "entity-header" },
				...activeIndicators.map((indicator) => ({
					key: `indicator:${indicator}`,
					label: indicator,
					className: "indicator-header",
				})),
			];

			const headerHtml = headerCells
				.map((cell) => {
					const isCurrent = this.sortState.column === cell.key;
					const icon = isCurrent
						? this.sortState.direction === "asc"
							? "↑"
							: "↓"
						: "↕";
					const classAttr = cell.className ? ` class="${cell.className}"` : "";
					return `<th data-sort="${cell.key}"${classAttr}>${cell.label} <span class="sort-icon">${icon}</span></th>`;
				})
				.join("");

			tableHead.innerHTML = `<tr>${headerHtml}</tr>`;
		}

		if (!tbody) {
			return;
		}

		if (activeIndicators.length === 0) {
			const colspan = Math.max(columnCount, 1);
			tbody.innerHTML = `<tr><td colspan="${colspan}" class="no-data">Selecione ao menos um indicador da tabela</td></tr>`;
			return;
		}

		if (!data || data.length === 0) {
			tbody.innerHTML = `<tr><td colspan="${columnCount}" class="no-data">Nenhum dado encontrado com os filtros da tabela</td></tr>`;
			return;
		}

		const grouped = new Map();
		data.forEach((item) => {
			const key = `${item.gerente || ""}__${item.agencia || ""}`;
			if (!grouped.has(key)) {
				grouped.set(key, {
					gerente: item.gerente,
					agencia: item.agencia,
					indicators: {},
				});
			}

			grouped.get(key).indicators[item.indicador] = {
				valor1: item.valor1,
				valor2: item.valor2,
				diferenca: item.diferenca,
				percentual: item.percentual,
			};
		});

		let rows = Array.from(grouped.values());
		const sortColumn = this.sortState.column;

		if (sortColumn) {
			const directionFactor = this.sortState.direction === "asc" ? 1 : -1;
			rows = rows.sort((a, b) => {
				if (sortColumn === "agencia") {
					const valueA = (a.agencia || "").toLowerCase();
					const valueB = (b.agencia || "").toLowerCase();
					if (valueA < valueB) return -1 * directionFactor;
					if (valueA > valueB) return 1 * directionFactor;
					return 0;
				}

				if (sortColumn.startsWith("indicator:")) {
					const indicatorName = sortColumn.split(":")[1];
					const diffA = a.indicators[indicatorName]?.diferenca ?? 0;
					const diffB = b.indicators[indicatorName]?.diferenca ?? 0;
					if (diffA < diffB) return -1 * directionFactor;
					if (diffA > diffB) return 1 * directionFactor;
					return 0;
				}

				return 0;
			});
		}

		tbody.innerHTML = rows
			.map((row) => {
				const indicatorCells = activeIndicators
					.map((indicator) => {
						const indicatorData = row.indicators[indicator];

						if (!indicatorData) {
							return `<td class="indicator-cell empty">—</td>`;
						}

						const isMonetary = this.currencyIndicators.includes(indicator);
						const diffValue = this.formatDifference(
							indicatorData.diferenca,
							isMonetary,
						);
						const diffClass =
							indicatorData.diferenca > 0
								? "positive"
								: indicatorData.diferenca < 0
									? "negative"
									: "neutral";
						const baseValue1 = isMonetary
							? this.formatCurrency(indicatorData.valor1)
							: this.formatNumber(indicatorData.valor1);
						const baseValue2 = isMonetary
							? this.formatCurrency(indicatorData.valor2)
							: this.formatNumber(indicatorData.valor2);

						return `
                    <td class="indicator-cell">
                        <div class="indicator-diff ${diffClass}">${diffValue}</div>
                        <div class="indicator-values">
                            <span>${baseValue1}</span>
                            <span class="arrow">→</span>
                            <span>${baseValue2}</span>
                        </div>
                    </td>
                `;
					})
					.join("");

				const agenciaInfo = row.agencia
					? `<div class="entity-subtitle">${row.agencia}</div>`
					: "";

				return `
	                <tr>
	                    <td class="entity-cell">
	                        <div class="entity-title">${row.gerente || "—"}</div>
	                        ${agenciaInfo}
	                    </td>
	                    ${indicatorCells}
	                </tr>
	        `;
			})
			.join("");
	}

	renderChart() {
		const data = this.filteredData;

		if (this.currentChart) {
			this.currentChart.destroy();
		}

		if (data.length === 0) {
			return;
		}

		const ctx = document.getElementById("mainChart").getContext("2d");

		// Agrupar dados por gerente
		const groupedData = {};
		data.forEach((item) => {
			if (!groupedData[item.gerente]) {
				groupedData[item.gerente] = { valor1: 0, valor2: 0 };
			}
			groupedData[item.gerente].valor1 += Math.abs(item.valor1);
			groupedData[item.gerente].valor2 += Math.abs(item.valor2);
		});

		const labels = Object.keys(groupedData).slice(0, 10);
		const valores1 = labels.map((label) => groupedData[label].valor1);
		const valores2 = labels.map((label) => groupedData[label].valor2);

		const config = {
			type: "bar",
			data: {
				labels: labels.map((label) =>
					label.length > 15 ? label.substring(0, 15) + "..." : label,
				),
				datasets: [
					{
						label: "Período 1",
						data: valores1,
						backgroundColor: "#1FB8CD",
						borderColor: "#1FB8CD",
						borderWidth: 2,
					},
					{
						label: "Período 2",
						data: valores2,
						backgroundColor: "#FFC185",
						borderColor: "#FFC185",
						borderWidth: 2,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: true,
						text: "Comparação de Indicadores por Gerente (Barras)",
					},
					legend: {
						display: true,
					},
					tooltip: {
						callbacks: {
							label: (context) =>
								context.dataset.label +
								": " +
								new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(context.parsed.y),
						},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							callback: (value) =>
								new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
									minimumFractionDigits: 0,
									maximumFractionDigits: 0,
								}).format(value),
						},
					},
				},
			},
		};

		this.currentChart = new Chart(ctx, config);
	}

	sortTable(column) {
		if (this.sortState.column === column) {
			this.sortState.direction =
				this.sortState.direction === "asc" ? "desc" : "asc";
		} else {
			this.sortState.column = column;
			this.sortState.direction = "asc";
		}

		this.renderTable();
	}

	resetUpload() {
		// Reset file inputs and data
		document.getElementById("file1").value = "";
		document.getElementById("file2").value = "";
		this.file1Data = null;
		this.file2Data = null;

		// Reset file info displays
		this.resetFileInfo(1);
		this.resetFileInfo(2);

		// Clear messages
		document.getElementById("uploadMessages").innerHTML = "";

		// Show upload section and hide dashboard
		document.getElementById("uploadSection").classList.remove("hidden");
		document.getElementById("dashboardContent").classList.add("hidden");

		// Reset dashboard data
		this.processedData = [];
		this.filteredData = [];
		this.tableFilteredData = [];
		this.tableFilters = { gerente: "", agencia: "" };
		this.sortState = { column: "", direction: "asc" };

		const tableGerenteSelect = document.getElementById("tableGerenteSelect");
		const tableAgenciaSelect = document.getElementById("tableAgenciaSelect");
		if (tableGerenteSelect) {
			tableGerenteSelect.innerHTML = '<option value="">Todos</option>';
			tableGerenteSelect.value = "";
		}
		if (tableAgenciaSelect) {
			tableAgenciaSelect.innerHTML = '<option value="">Todas</option>';
			tableAgenciaSelect.value = "";
		}

		Object.values(this.tableIndicatorCheckboxMap).forEach((id) => {
			const checkbox = document.getElementById(id);
			if (checkbox) {
				checkbox.checked = true;
			}
		});

		const tableBody = document.getElementById("tableBody");
		if (tableBody) {
			tableBody.innerHTML = "";
		}

		const tableHead = document.getElementById("tableHead");
		if (tableHead) {
			tableHead.innerHTML = "";
		}

		// Destroy chart if exists
		if (this.currentChart) {
			this.currentChart.destroy();
			this.currentChart = null;
		}

		// Update header
		document.querySelector(".subtitle").textContent =
			"Faça upload de dois arquivos CSV para comparação";

		// Ensure button is properly disabled
		this.initializeButtonState();
	}
}

// Initialize the dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
	new DashboardController();
});
