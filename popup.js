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

	// Prompt Template textarea'sının içeriğini temizle, sadece placeholder görünsün
	promptTemplateInput.value = ''

	tabs.forEach((tab) => {
		tab.addEventListener('click', () => {
			tabs.forEach((t) => t.classList.remove('active'))
			tab.classList.add('active')

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
	} catch (error) {
		console.error('Ayarlar yüklenirken hata:', error)
	}

	function showStatus(message, type = 'info') {
		statusDiv.textContent = message
		statusDiv.className = `status ${type}`
		statusDiv.style.display = 'block'

		setTimeout(() => {
			statusDiv.style.display = 'none'
		}, 5000)
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
			showStatus('Lütfen bir API anahtarı girin.', 'error')
			return
		}

		try {
			await chrome.storage.sync.set({
				geminiApiKey: apiKey,
				promptTemplate: promptTemplate || DEFAULT_PROMPT_TEMPLATE
			})
			showStatus('Ayarlar kaydedildi!', 'success')
		} catch (error) {
			console.error('Ayarlar kaydedilirken hata:', error)
			showStatus('Ayarlar kaydedilirken bir hata oluştu.', 'error')
		}
	})

	generateACButton.addEventListener('click', async () => {
		if (isGenerating) return

		const description = descriptionInput.value.trim()
		if (!description) {
			showStatus('Lütfen bir açıklama girin.', 'error')
			return
		}

		try {
			const data = await chrome.storage.sync.get('geminiApiKey')
			const apiKey = data.geminiApiKey

			if (!apiKey) {
				showStatus(
					'API anahtarı bulunamadı. Lütfen ayarlar sekmesinden bir API anahtarı girin.',
					'error'
				)
				tabs[1].click()
				return
			}

			isGenerating = true
			generateACButton.disabled = true
			generateACButton.innerHTML =
				'<span class="spinner"></span> Oluşturuluyor...'
			showStatus('Acceptance Criteria oluşturuluyor...', 'info')

			const promptTemplateData = await chrome.storage.sync.get(
				'promptTemplate'
			)
			let promptTemplate =
				promptTemplateData.promptTemplate || DEFAULT_PROMPT_TEMPLATE

			const prompt = promptTemplate.replace(
				'{description}',
				description
			)

			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{
										text: prompt
									}
								]
							}
						],
						generationConfig: {
							temperature: 0.7,
							topK: 40,
							topP: 0.95,
							maxOutputTokens: 2048
						}
					})
				}
			)

			const data2 = await response.json()

			if (
				!data2.candidates ||
				!data2.candidates[0] ||
				!data2.candidates[0].content ||
				!data2.candidates[0].content.parts ||
				!data2.candidates[0].content.parts[0] ||
				!data2.candidates[0].content.parts[0].text
			) {
				throw new Error(
					'API yanıtı beklenen formatta değil: ' +
						JSON.stringify(data2)
				)
			}

			generatedAC = data2.candidates[0].content.parts[0].text
			previewContent.innerHTML = formatACText(generatedAC)
			previewContainer.style.display = 'block'
			showStatus('Acceptance Criteria oluşturuldu!', 'success')
		} catch (error) {
			console.error('AC oluşturulurken hata:', error)
			showStatus(
				'Acceptance Criteria oluşturulurken bir hata oluştu: ' +
					error.message,
				'error'
			)
		} finally {
			isGenerating = false
			generateACButton.disabled = false
			generateACButton.innerHTML =
				'<span class="icon icon-generate"></span> Oluştur'
		}
	})

	copyButton.addEventListener('click', async () => {
		if (generatedAC) {
			try {
				await navigator.clipboard.writeText(generatedAC)
				showStatus('Acceptance Criteria kopyalandı!', 'success')
			} catch (error) {
				console.error('Kopyalama hatası:', error)
				showStatus('Kopyalama sırasında bir hata oluştu.', 'error')
			}
		}
	})

	function formatACText(text) {
		return text
			.replace(/\n/g, '<br>')
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>')
			.replace(
				/`(.*?)`/g,
				'<code style="background-color:rgba(0,0,0,0.1);padding:2px 4px;border-radius:3px;">$1</code>'
			)
			.replace(
				/^- (.*)/gm,
				'<div style="display:flex;margin:4px 0;"><span style="color:var(--primary-color);margin-right:8px;">•</span><span>$1</span></div>'
			)
	}

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
