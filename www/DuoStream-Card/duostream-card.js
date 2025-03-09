class DuoStreamCard extends HTMLElement {
  // Set config when the element is created
  setConfig(config) {
    if (!config.device_name) {
      throw new Error('You need to define the configuration name of the duostream device')
    } else {
      this._config = Object.create(null);
      this._config.formated_configuration_name = String(config.device_name).toLowerCase().replaceAll(" ", "_").replaceAll("-", "_")
      this._config.device_name = config.device_name
      this._config.service_entity = `switch.duostream_${this._config.formated_configuration_name}_service_switch`
      this._config.sessions_sensor = `sensor.duostream_${this._config.formated_configuration_name}_available_sessions`
      this._config.pc_entity = `sensor.duostream_${this._config.formated_configuration_name}_computer_status`
      if (config.wake_on_lan_entity)
        this._config.wake_on_lan_entity = config.wake_on_lan_entity
      Object.preventExtensions(this._config)
    }
    this._activeSessions = [];
  }

  // Set hass when Home Assistant connects
  set hass(hass) {
    this._hass = hass;
    if (!this._card) {
      this._createCard();
    }

    this._updateCard();
  }

  // Create the card DOM
  _createCard() {

    const darkMode = this._hass.themes.darkMode;

    const theme = {
      cardBg: darkMode ? '#1c1c1c' : undefined,
      textColor: darkMode ? '#e1e1e1' : '#333',
      subtitleColor: darkMode ? '#a0a0a0' : '#666',
      statusBoxBg: darkMode ? '#2d2d2d' : '#f5f5f5',
      borderColor: darkMode ? '#555' : '#ccc',
      disabledColor: darkMode ? '#555' : '#cccccc'
    };

    this._theme = theme

    const card = document.createElement('ha-card');
    card.header = `DuoStream Control ${this._config.device_name}`;
        // Set card background if in dark mode
    if (this._theme.cardBg) {
      card.style.backgroundColor = this._theme.cardBg;
      card.style.color = this._theme.textColor;
    }

    this._card = card;

    // Create container for card content
    const content = document.createElement('div');
    content.className = 'card-content';

    // Status indicators
    const statusRow = document.createElement('div');
    statusRow.style.display = 'flex';
    statusRow.style.justifyContent = 'space-between';
    statusRow.style.marginBottom = '16px';

    // PC Status
    const pcStatusBox = document.createElement('div');
    pcStatusBox.style.flex = '1';
    pcStatusBox.style.textAlign = 'center';
    pcStatusBox.style.padding = '8px';
    pcStatusBox.style.backgroundColor = this._theme.statusBoxBg;
    pcStatusBox.style.color = this._theme.textColor;
    pcStatusBox.style.borderRadius = '8px';
    pcStatusBox.style.marginRight = '8px';

    const pcIcon = document.createElement('div');
    pcIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
    pcIcon.style.margin = '0 auto 8px';

    const pcTitle = document.createElement('p');
    pcTitle.textContent = 'PC Status';
    pcTitle.style.fontWeight = 'bold';
    pcTitle.style.margin = '0';

    this._pcStatus = document.createElement('p');
    this._pcStatus.style.margin = '4px 0 0';
    this._pcStatus.style.fontSize = '14px';
    this._pcStatus.style.color = this._theme.subtitleColor;


    pcStatusBox.appendChild(pcIcon);
    pcStatusBox.appendChild(pcTitle);
    pcStatusBox.appendChild(this._pcStatus);

    // Service Status
    const serviceStatusBox = document.createElement('div');
    serviceStatusBox.style.flex = '1';
    serviceStatusBox.style.textAlign = 'center';
    serviceStatusBox.style.padding = '8px';
    serviceStatusBox.style.backgroundColor = this._theme.statusBoxBg;
    serviceStatusBox.style.color = this._theme.textColor;
    serviceStatusBox.style.borderRadius = '8px';

    const serviceIcon = document.createElement('div');
    serviceIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>';
    serviceIcon.style.margin = '0 auto 8px';

    const serviceTitle = document.createElement('p');
    serviceTitle.textContent = 'Service Status';
    serviceTitle.style.fontWeight = 'bold';
    serviceTitle.style.margin = '0';

    this._serviceStatus = document.createElement('p');
    this._serviceStatus.style.margin = '4px 0 0';
    this._serviceStatus.style.fontSize = '14px';
    this._serviceStatus.style.color = this._theme.subtitleColor;

    serviceStatusBox.appendChild(serviceIcon);
    serviceStatusBox.appendChild(serviceTitle);
    serviceStatusBox.appendChild(this._serviceStatus);

    statusRow.appendChild(pcStatusBox);
    statusRow.appendChild(serviceStatusBox);

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column';
    buttonsContainer.style.gap = '12px';

    // Wake on LAN button
    this._wakeButton = document.createElement('button');
    this._wakeButton.className = 'mdc-button';
    this._wakeButton.style.width = '100%';
    this._wakeButton.style.backgroundColor = '#4287f5';
    this._wakeButton.style.color = 'white';
    this._wakeButton.style.padding = '12px';
    this._wakeButton.style.borderRadius = '8px';
    this._wakeButton.style.border = 'none';
    this._wakeButton.style.cursor = 'pointer';
    this._wakeButton.style.display = 'flex';
    this._wakeButton.style.alignItems = 'center';
    this._wakeButton.style.justifyContent = 'center';

    const wakeIcon = document.createElement('span');
    wakeIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>';

    this._wakeButtonText = document.createElement('span');
    this._wakeButtonText.textContent = 'Wake PC';

    this._wakeButton.appendChild(wakeIcon);
    this._wakeButton.appendChild(this._wakeButtonText);

    // Service toggle button
    this._serviceButton = document.createElement('button');
    this._serviceButton.className = 'mdc-button';
    this._serviceButton.style.width = '100%';
    this._serviceButton.style.backgroundColor = '#4caf50';
    this._serviceButton.style.color = 'white';
    this._serviceButton.style.padding = '12px';
    this._serviceButton.style.borderRadius = '8px';
    this._serviceButton.style.border = 'none';
    this._serviceButton.style.cursor = 'pointer';
    this._serviceButton.style.display = 'flex';
    this._serviceButton.style.alignItems = 'center';
    this._serviceButton.style.justifyContent = 'center';

    const serviceButtonIcon = document.createElement('span');
    serviceButtonIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="6" y1="11" x2="10" y2="15"></line><line x1="12" y1="5" x2="10" y2="15"></line><line x1="18" y1="9" x2="12" y2="5"></line><line x1="21" y1="16" x2="18" y2="9"></line><line x1="15" y1="20" x2="21" y2="16"></line><line x1="6" y1="11" x2="15" y2="20"></line></svg>';

    this._serviceButtonText = document.createElement('span');
    this._serviceButtonText.textContent = 'Start Service';

    this._serviceButton.appendChild(serviceButtonIcon);
    this._serviceButton.appendChild(this._serviceButtonText);

    // Active Sessions Container - Scroll View
    const activeSessionsLabel = document.createElement('div');
    activeSessionsLabel.textContent = 'Active Sessions:';
    activeSessionsLabel.style.marginBottom = '8px';
    activeSessionsLabel.style.marginTop = '12px';

    this._activeSessionsContainer = document.createElement('div');
    this._activeSessionsContainer.style.maxHeight = '100px'; // Height for 2 items + scroll
    this._activeSessionsContainer.style.overflowY = 'auto';
    this._activeSessionsContainer.style.border = `1px solid ${this._theme.borderColor}`;
    this._activeSessionsContainer.style.backgroundColor = this._theme.statusBoxBg;
    this._activeSessionsContainer.style.borderRadius = '8px';
    this._activeSessionsContainer.style.marginBottom = '12px';


    // Session selector
    const sessionSelector = document.createElement('div');
    sessionSelector.style.marginTop = '12px';

    const sessionLabel = document.createElement('div');
    sessionLabel.textContent = 'Available Sessions:';
    sessionLabel.style.marginBottom = '8px';

    this._sessionSelect = document.createElement('select');
    this._sessionSelect.style.width = '100%';
    this._sessionSelect.style.padding = '10px';
    this._sessionSelect.style.borderRadius = '8px';
    this._sessionSelect.style.border = `1px solid ${this._theme.borderColor}`;
    this._sessionSelect.style.backgroundColor = this._theme.statusBoxBg;
    this._sessionSelect.style.color = this._theme.textColor;


    sessionSelector.appendChild(sessionLabel);
    sessionSelector.appendChild(this._sessionSelect);

    // Session toggle button
    this._sessionButton = document.createElement('button');
    this._sessionButton.className = 'mdc-button';
    this._sessionButton.style.width = '100%';
    this._sessionButton.style.backgroundColor = '#673ab7';
    this._sessionButton.style.color = 'white';
    this._sessionButton.style.padding = '12px';
    this._sessionButton.style.borderRadius = '8px';
    this._sessionButton.style.border = 'none';
    this._sessionButton.style.cursor = 'pointer';
    this._sessionButton.style.marginTop = '12px';
    this._sessionButton.style.display = 'flex';
    this._sessionButton.style.alignItems = 'center';
    this._sessionButton.style.justifyContent = 'center';

    const sessionButtonIcon = document.createElement('span');
    sessionButtonIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';

    this._sessionButtonText = document.createElement('span');
    this._sessionButtonText.textContent = 'Start Session';

    this._sessionButton.appendChild(sessionButtonIcon);
    this._sessionButton.appendChild(this._sessionButtonText);

    // Add all elements to containers
    buttonsContainer.appendChild(this._wakeButton);
    buttonsContainer.appendChild(this._serviceButton);
    buttonsContainer.appendChild(activeSessionsLabel);
    buttonsContainer.appendChild(this._activeSessionsContainer);
    buttonsContainer.appendChild(sessionSelector);
    buttonsContainer.appendChild(this._sessionButton);

    this._wakeButton.cleanup = this._addButtonClickEffect(this._wakeButton, {
      normalColor: '#4287f5',  // Couleur normale
      activeColor: '#3269cc',  // Couleur quand cliqué
      disabledColor: '#cccccc' // Couleur quand désactivé
    });
    this._serviceButton.cleanup = this._addButtonClickEffect(this._serviceButton, {
      normalColor: '#4caf50',  // Couleur normale
      activeColor: '#3d8b40',  // Couleur quand cliqué
      disabledColor: '#cccccc' // Couleur quand désactivé
    });
    this._sessionButton.cleanup = this._addButtonClickEffect(this._sessionButton, {
      normalColor: '#673ab7',  // Couleur normale
      activeColor: '#5e34a0',  // Couleur quand cliqué
      disabledColor: '#cccccc' // Couleur quand désactivé
    });

    content.appendChild(statusRow);
    content.appendChild(buttonsContainer);
    card.appendChild(content);

    // Add event listeners
    this._wakeButton.addEventListener('click', () => this._toggleWakeOnLan());
    this._serviceButton.addEventListener('click', () => this._toggleService());
    this._sessionButton.addEventListener('click', () => this._toggleSession());
    this._sessionSelect.addEventListener('change', () => this._sessionSelected());

    // Add card to the DOM
    this.appendChild(card);
  }

  // Update the card with current state
  _updateCard() {
    if (!this._hass || !this._config) {
      return;
    }

    // Update PC status
    const pcState = this._getPcStatus();
    this._pcStatus.textContent = pcState.charAt(0).toUpperCase() + pcState.slice(1);

    // Update service status
    const serviceState = this._getServiceStatus();
    this._serviceStatus.textContent = serviceState.charAt(0).toUpperCase() + serviceState.slice(1);

    // Update Wake on LAN button
    const wolState = this._getWakeOnLanStatus();
    if (wolState === 'on') {
      this._wakeButton.style.backgroundColor = '#f44336';
      this._wakeButtonText.textContent = 'Shutdown PC';
      this._wakeButton.cleanup()
      this._wakeButton.cleanup = this._addButtonClickEffect(this._serviceButton, {
        normalColor: '#f44336',  // Couleur normale
        activeColor: '#d32f2f',  // Couleur quand cliqué
        disabledColor: '#cccccc' // Couleur quand désactivé
      });

    } else {
      this._wakeButton.style.backgroundColor = '#4287f5';
      this._wakeButtonText.textContent = 'Wake PC';
      this._wakeButton.cleanup()
      this._wakeButton.cleanup = this._addButtonClickEffect(this._wakeButton, {
        normalColor: '#4287f5',  // Couleur normale
        activeColor: '#3269cc',  // Couleur quand cliqué
        disabledColor: '#cccccc' // Couleur quand désactivé
      });

    }

    // Update service button
    if (serviceState === 'running') {
      this._serviceButton.style.backgroundColor = '#f44336';
      this._serviceButtonText.textContent = 'Stop Service';
      this._serviceButton.cleanup()
      this._serviceButton.cleanup = this._addButtonClickEffect(this._serviceButton, {
        normalColor: '#f44336',  // Couleur normale
        activeColor: '#d32f2f',  // Couleur quand cliqué
        disabledColor: '#cccccc' // Couleur quand désactivé
      });

    } else {
      this._serviceButton.style.backgroundColor = '#4caf50';
      this._serviceButtonText.textContent = 'Start Service';
      this._serviceButton.cleanup()
      this._serviceButton.cleanup = this._addButtonClickEffect(this._serviceButton, {
        normalColor: '#4caf50',
        activeColor: '#3d8b40',
        disabledColor: '#cccccc'
      });

    }

    // Get all sessions and update UI
    this._updateSessionsUI();
  }

  // Get PC status
  _getPcStatus() {
    const pcEntity = this._config.pc_entity;
    return this._hass.states[pcEntity] ? this._hass.states[pcEntity].state : 'unknown';
  }

  // Get service status
  _getServiceStatus() {
    const serviceEntity = this._config.service_entity;
    return this._hass.states[serviceEntity] ? (this._hass.states[serviceEntity].state === "on" ? "running" : "stopped" ) : 'unknown';
  }

  // Get Wake on LAN status
  _getWakeOnLanStatus() {
    const wolEntity = this._config.wake_on_lan_entity;
    return this._hass.states[wolEntity] ? this._hass.states[wolEntity].state : 'unknown';
  }

  // Toggle Wake on LAN
  _toggleWakeOnLan() {
    const wolEntity = this._config.wake_on_lan_entity;
    const state = this._getWakeOnLanStatus();
    const service = state === 'on' ? 'turn_off' : 'turn_on';

    this._hass.callService('switch', service, {
      entity_id: wolEntity
    });
  }

  // Toggle service
  _toggleService() {
    const serviceEntity = this._config.service_entity;
    const state = this._getServiceStatus();
    const service = state === 'running' ? 'turn_off' : 'turn_on';

    this._hass.callService('switch', service, {
      entity_id: serviceEntity
    });
  }

  // Update sessions UI (both active sessions scroll view and available sessions dropdown)
  _updateSessionsUI() {
    const sessionsEntity = this._config.sessions_sensor;
    if (!this._hass.states[sessionsEntity]) {
      return;
    }

    // Get all available sessions from sensor
    const allSessions = this._hass.states[sessionsEntity].attributes.available_sessions || [];

    // Clear active sessions container
    while (this._activeSessionsContainer.firstChild) {
      this._activeSessionsContainer.removeChild(this._activeSessionsContainer.firstChild);
    }

    // Determine active and inactive sessions
    const activeSessions = [];
    const inactiveSessions = [];

    allSessions.forEach(session => {
      const formattedSession = session.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
      const entityId = `switch.duostream_${this._config.formated_configuration_name}_session_${formattedSession}`;
      const state = this._hass.states[entityId] ? this._hass.states[entityId].state : 'off';

      if (state === 'on') {
        activeSessions.push(session);
      } else {
        inactiveSessions.push(session);
      }
    });

    // Update active sessions scroll view
    this._updateActiveSessionsView(activeSessions);

    // Update available sessions dropdown
    this._updateSessionsDropdown(inactiveSessions);
  }

  // Update active sessions scroll view
  _updateActiveSessionsView(activeSessions) {
    if (activeSessions.length === 0) {
      const noActiveSessions = document.createElement('div');
      noActiveSessions.textContent = 'No active sessions';
      noActiveSessions.style.padding = '10px';
      noActiveSessions.style.textAlign = 'center';
      noActiveSessions.style.color = this._theme.subtitleColor;
      this._activeSessionsContainer.appendChild(noActiveSessions);
      return;
    }

    activeSessions.forEach(session => {
      const sessionItem = document.createElement('div');
      sessionItem.style.display = 'flex';
      sessionItem.style.justifyContent = 'space-between';
      sessionItem.style.alignItems = 'center';
      sessionItem.style.padding = '10px';
      sessionItem.style.borderBottom = '1px solid #eee';

      const sessionName = document.createElement('span');
      sessionName.textContent = session;
      sessionName.style.color = this._theme.textColor; 

      const stopButton = document.createElement('button');
      stopButton.innerHTML = '&#10005;'; // × symbol
      stopButton.style.backgroundColor = '#f44336';
      stopButton.style.color = 'white';
      stopButton.style.border = 'none';
      stopButton.style.borderRadius = '50%';
      stopButton.style.width = '24px';
      stopButton.style.height = '24px';
      stopButton.style.cursor = 'pointer';
      stopButton.style.display = 'flex';
      stopButton.style.justifyContent = 'center';
      stopButton.style.alignItems = 'center';
      stopButton.cleanup = this._addButtonClickEffect(stopButton, {
        normalColor: '#f44336',  
        activeColor: '#d32f2f',
        disabledColor: '#cccccc'
      });

      stopButton.addEventListener('click', () => this._stopSession(session));
      stopButton.addEventListener('click', () => stopButton.cleanup());

      sessionItem.appendChild(sessionName);
      sessionItem.appendChild(stopButton);
      this._activeSessionsContainer.appendChild(sessionItem);
    });
  }

  // Stop a specific session
  _stopSession(session) {
    const formattedSession = session.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
    const entityId = `switch.duostream_${this._config.formated_configuration_name}_session_${formattedSession}`;

    this._hass.callService('switch', 'turn_off', {
      entity_id: entityId
    });
  }

  // Update available sessions dropdown
  _updateSessionsDropdown(inactiveSessions) {
    // Save current selection
    const currentSelection = this._sessionSelect.value;

    // Clear select options
    while (this._sessionSelect.firstChild) {
      this._sessionSelect.removeChild(this._sessionSelect.firstChild);
    }

    if (inactiveSessions.length === 0 ) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No available sessions';
      option.disabled = true;
      this._sessionSelect.appendChild(option);
      this._sessionSelect.value = ''
      this._updateSessionButton()
      return;
    }

    // Add new options for inactive sessions
    inactiveSessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session;
      option.textContent = session;
      this._sessionSelect.appendChild(option);
    });

    // Restore selection if possible or select first option
    if (inactiveSessions.includes(currentSelection)) {
      this._sessionSelect.value = currentSelection;
    } else {
      this._sessionSelect.selectedIndex = 0;
      this._sessionSelect.value = inactiveSessions[0]
    }

    this._updateSessionButton()
  }

  // Session selected event handler
  _sessionSelected() {
    this._updateSessionButton();
  }

  // Update session button state
  _updateSessionButton() {
    const session = this._sessionSelect.value;
    const serviceState = this._getServiceStatus();

    // If no session is selected or there are no options, disable the button
    if (!session || this._sessionSelect.childElementCount === 0 || serviceState === "stopped") {
      this._sessionButton.disabled = true;
      this._sessionButton.style.backgroundColor = this._sessionButton.disabled ? this._theme.disabledColor : '#673ab7';
      this._sessionButton.style.cursor = 'not-allowed'; // Change cursor to indicate non-clickable
      this._sessionButtonText.textContent = `No Sessions Available`;
      return;
    }

    // Enable the button if a session is selected
    this._sessionButton.disabled = false;
    this._sessionButton.style.backgroundColor = '#673ab7'; // Original purple color
    this._sessionButton.style.cursor = 'pointer'; // Restore pointer cursor
    this._sessionButtonText.textContent = `Start ${session}`;


  }

  // Toggle session (start only, because active sessions are handled in the scroll view)
  _toggleSession() {
    const session = this._sessionSelect.value;
    if (!session) {
      return;
    }

    const formattedSession = session.toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
    const entityId = `switch.duostream_${this._config.formated_configuration_name}_session_${formattedSession}`;

    this._hass.callService('switch', 'turn_on', {
      entity_id: entityId
    });
  }
  /**
   * Adds click effects to a button element
   * @param {HTMLElement} button - The button element to enhance
   * @param {Object} options - Configuration options
   * @param {string} options.activeColor - Background color when button is active (default: '#5e34a0')
   * @param {string} options.normalColor - Normal background color (default: '#673ab7')
   * @param {string} options.disabledColor - Background color when disabled (default: '#cccccc')
   * @param {number} options.scaleAmount - Amount to scale down when clicked (default: 0.95)
   * @param {boolean} options.addShadow - Whether to add inner shadow effect (default: true)
   */
  _addButtonClickEffect(button, options = {}) {
    // Default options
    const settings = {
      activeColor: options.activeColor || '#5e34a0',
      normalColor: options.normalColor || '#673ab7',
      disabledColor: options.disabledColor || (darkMode ? '#555' : '#cccccc'),
      scaleAmount: options.scaleAmount || 0.95,
      addShadow: options.addShadow !== undefined ? options.addShadow : true
    };
  
    // Save original styles
    const originalTransform = button.style.transform || 'scale(1)';
    const originalTransition = button.style.transition || '';
    const originalBoxShadow = button.style.boxShadow || '';
  
    // Add transition for smooth effect
    button.style.transition = 'transform 0.1s, background-color 0.1s, box-shadow 0.1s';
  
    // Store event handler references
    const mousedownHandler = () => {
      if (!button.disabled) {
        button.style.transform = `scale(${settings.scaleAmount})`;
        button.style.backgroundColor = settings.activeColor;
  
        if (settings.addShadow) {
          button.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.2)';
        }
      }
    };
  
    const mouseupHandler = () => {
      if (!button.disabled) {
        button.style.transform = originalTransform;
        button.style.backgroundColor = settings.normalColor;
        button.style.boxShadow = originalBoxShadow;
      }
    };
  
    const mouseleaveHandler = () => {
      if (!button.disabled) {
        button.style.transform = originalTransform;
        button.style.backgroundColor = settings.normalColor;
        button.style.boxShadow = originalBoxShadow;
      }
    };
  
    // Add event listeners with named handlers
    button.addEventListener('mousedown', mousedownHandler);
    button.addEventListener('mouseup', mouseupHandler);
    button.addEventListener('mouseleave', mouseleaveHandler);
  
    // Update button style when disabled state changes
    const updateDisabledState = () => {
      if (button.disabled) {
        button.style.backgroundColor = settings.disabledColor;
        button.style.cursor = 'not-allowed';
      } else {
        button.style.backgroundColor = settings.normalColor;
        button.style.cursor = 'pointer';
      }
    };
  
    // Run once to set initial state
    updateDisabledState();
  
    // Create a mutation observer to watch for disabled attribute changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'disabled') {
          updateDisabledState();
        }
      });
    });
  
    // Start observing the button for disabled attribute changes
    observer.observe(button, { attributes: true });
  
    // Return a function to remove all event listeners and observer
    return function cleanup() {
      button.removeEventListener('mousedown', mousedownHandler);
      button.removeEventListener('mouseup', mouseupHandler);
      button.removeEventListener('mouseleave', mouseleaveHandler);
      observer.disconnect();
    };
  }
  // Get card size
  getCardSize() {
    return 5; // Increased size for the added scroll view
  }
}

// Register the element with Home Assistant
customElements.define('duostream-card', DuoStreamCard);

// Add to custom cards list
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'duostream-card',
  name: 'DuoStream Card',
  description: 'Control DuoStream and computer with active sessions display and Wake-on-LAN functionality'
});