document.addEventListener('DOMContentLoaded', async function () {
	const apiKeyInput = document.getElementById('apiKey')
	const descriptionInput = document.getElementById('description')
	const promptTemplateInput =
		document.getElementById('promptTemplate')
	const generateACButton = document.getElementById('generateAC')
	const statusDiv = document.getElementById('status')
	const previewContainer = document.getElementById('previewContainer')
	const previewContent = document.getElementById('previewContent')
	const copyButton = document.getElementById('copyButton')
	const tabs = document.querySelectorAll('.tab')
	const tabContents = document.querySelectorAll('.tab-content')
	const saveSettingsButton = document.getElementById('saveSettings')

	const DEFAULT_PROMPT_TEMPLATE = `Bu Azure DevOps iş öğesi açıklamasından Türkçe Acceptance Criteria oluştur. Maddeler halinde, anlaşılır ve test edilebilir kriterler olmalı. 
Açıklamaya göre request, response, endpoint URL'sini oluştur ve ingilizce yap.

Açıklama: {description}`

	let generatedAC = null
	let isGenerating = false

	// Sekme yapısını ayarla
	tabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			// Aktif sekmeyi değiştir
			tabs.forEach((t) => t.classList.remove('active'))
			tab.classList.add('active')

			// İlgili içeriği göster
			const tabName = tab.getAttribute('data-tab')
			tabContents.forEach((content) => {
				content.classList.remove('active')
			})
			document
				.getElementById(`${tabName}-content`)
				.classList.add('active')
		})
	})

	try {
		const data = await chrome.storage.sync.get([
			'geminiApiKey',
			'promptTemplate'
		])
		if (data.geminiApiKey) {
			apiKeyInput.value = data.geminiApiKey
		}
		if (data.promptTemplate) {
			promptTemplateInput.value = data.promptTemplate
		}
	} catch (error) {
		console.error('Storage erişim hatası:', error)
	}

	function showStatus(message, type) {
		statusDiv.textContent = message
		statusDiv.className = `status ${type}`

		if (type === 'success') {
			setTimeout(() => {
				statusDiv.className = 'status'
			}, 4000)
		}
	}

	function togglePreview(show, content = '') {
		if (show) {
			previewContent.textContent = content
			previewContainer.classList.add('visible')

			setTimeout(() => {
				previewContainer.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest'
				})
			}, 100)
		} else {
			previewContainer.classList.remove('visible')
			setTimeout(() => {
				previewContent.textContent = ''
			}, 300)
		}
	}

	function updateButtonState(isLoading) {
		isGenerating = isLoading
		generateACButton.disabled = isLoading

		if (isLoading) {
			generateACButton.innerHTML =
				'<span class="spinner"></span><span>İşleniyor...</span>'
			generateACButton.classList.add('loading-state')
		} else {
			generateACButton.innerHTML =
				'<span class="icon icon-generate"></span> Acceptance Criteria Oluştur'
			generateACButton.classList.remove('loading-state')
		}
	}

	function validateInputs() {
		const apiKey = apiKeyInput.value.trim()
		const description = descriptionInput.value.trim()
		const promptTemplate = promptTemplateInput.value.trim()

		if (!apiKey) {
			showStatus('Lütfen API anahtarınızı girin', 'error')
			tabs.forEach((t) => t.classList.remove('active'))
			document
				.querySelector('[data-tab="settings"]')
				.classList.add('active')
			tabContents.forEach((content) => {
				content.classList.remove('active')
			})
			document
				.getElementById('settings-content')
				.classList.add('active')
			apiKeyInput.focus()
			return false
		}

		if (!description) {
			showStatus('Lütfen iş öğesi açıklamasını girin', 'error')
			descriptionInput.focus()
			return false
		}

		if (!promptTemplate) {
			showStatus('Lütfen prompt template giriniz', 'error')
			promptTemplateInput.focus()
			return false
		}

		return true
	}

	saveSettingsButton.addEventListener('click', async () => {
		const apiKey = apiKeyInput.value.trim()
		const promptTemplate = promptTemplateInput.value.trim()

		if (!apiKey) {
			showStatus('Lütfen API anahtarınızı girin', 'error')
			apiKeyInput.focus()
			return
		}

		if (!promptTemplate) {
			showStatus('Lütfen prompt template giriniz', 'error')
			promptTemplateInput.focus()
			return
		}

		try {
			await chrome.storage.sync.set({
				geminiApiKey: apiKey,
				promptTemplate: promptTemplate
			})
			showStatus('Ayarlar başarıyla kaydedildi!', 'success')

			// Otomatik olarak oluşturucu sekmesine geç
			setTimeout(() => {
				tabs.forEach((t) => t.classList.remove('active'))
				document
					.querySelector('[data-tab="generator"]')
					.classList.add('active')
				tabContents.forEach((content) => {
					content.classList.remove('active')
				})
				document
					.getElementById('generator-content')
					.classList.add('active')
			}, 1500)
		} catch (error) {
			console.error('Storage kayıt hatası:', error)
			showStatus('Ayarlar kaydedilirken hata oluştu', 'error')
		}
	})

	generateACButton.addEventListener('click', async () => {
		if (!validateInputs()) return

		const apiKey = apiKeyInput.value.trim()
		const description = descriptionInput.value.trim()
		let customTemplate =
			(await chrome.storage.sync.get('promptTemplate'))
				.promptTemplate || ''

		const prompt = `Bu Azure DevOps iş öğesi açıklamasından Türkçe Acceptance Criteria oluştur. Maddeler halinde, anlaşılır ve test edilebilir kriterler olmalı. 
		Açıklamaya göre request, response, endpoint URL'sini oluştur ve ingilizce olsun fakat ingilizce olduğunu belirtme.

		Açıklama: ${description}

		${
			customTemplate
				? `Aşağıdaki ek kriterleri de response'un en sonunda yer alsın ve madde madde olsun. Not şeklinde yazılmasın. Kesinlikle madde madde yazılması gerekiyor. :
		${customTemplate}`
				: ''
		}`

		togglePreview(false)
		generatedAC = null

		try {
			await chrome.storage.sync.set({ geminiApiKey: apiKey })
		} catch (error) {
			console.error('Storage kayıt hatası:', error)
		}

		updateButtonState(true)
		showStatus('Acceptance Criteria oluşturuluyor...', 'success')

		try {
			const geminiResponse = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [{ text: prompt }]
							}
						]
					})
				}
			)

			const data = await geminiResponse.json()
			if (
				data.candidates &&
				data.candidates[0].content.parts[0].text
			) {
				generatedAC = data.candidates[0].content.parts[0].text
				togglePreview(true, generatedAC)
				showStatus(
					'Acceptance Criteria başarıyla oluşturuldu!',
					'success'
				)
			} else {
				throw new Error(data.error?.message || 'API yanıtı geçersiz')
			}
		} catch (error) {
			console.error('API Hatası:', error)
			showStatus(`Hata oluştu: ${error.message}`, 'error')
			togglePreview(false)
		} finally {
			updateButtonState(false)
		}
	})

	descriptionInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && e.ctrlKey && !isGenerating) {
			e.preventDefault()
			generateACButton.click()
		}
	})

	const shortcutInfo = document.createElement('div')
	shortcutInfo.style.fontSize = '12px'
	shortcutInfo.style.color = 'var(--text-secondary)'
	shortcutInfo.style.marginTop = '4px'
	shortcutInfo.style.textAlign = 'right'
	shortcutInfo.innerHTML =
		'Kısayol: <kbd style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);">Ctrl</kbd> + <kbd style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);">Enter</kbd>'
	descriptionInput.parentNode.appendChild(shortcutInfo)

	copyButton.addEventListener('click', async () => {
		if (generatedAC) {
			try {
				await navigator.clipboard.writeText(generatedAC)

				// Geçici olarak ikonu değiştir
				const originalHTML = copyButton.innerHTML
				copyButton.innerHTML =
					'<span class="icon icon-check"></span><span>Kopyalandı!</span>'
				copyButton.style.color = 'var(--success-color)'

				setTimeout(() => {
					copyButton.innerHTML = originalHTML
					copyButton.style.color = ''
				}, 2000)

				showStatus('İçerik panoya kopyalandı!', 'success')
			} catch (err) {
				showStatus('Kopyalama işlemi başarısız oldu', 'error')
			}
		}
	})

	const style = document.createElement('style')
	style.textContent = `
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
		
		.spinner {
			display: inline-block;
			width: 16px;
			height: 16px;
			border: 2px solid rgba(255,255,255,0.3);
			border-radius: 50%;
			border-top-color: white;
			animation: spin 0.8s linear infinite;
			margin-right: 8px;
			flex-shrink: 0;
		}
		
		button.secondary .spinner {
			border: 2px solid rgba(255,255,255,0.3);
			border-top-color: white;
		}

		button.loading-state {
			display: inline-flex;
			justify-content: center;
			align-items: center;
		}

		.icon-check {
			background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%234cd964" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>');
			background-repeat: no-repeat;
			background-position: center;
			background-size: contain;
		}
	`
	document.head.appendChild(style)
})
