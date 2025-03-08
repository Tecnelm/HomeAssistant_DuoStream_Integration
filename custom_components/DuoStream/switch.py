from homeassistant.components.switch import SwitchEntity
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN
from .DuoStreamDevice import DuoStreamDevice, DuoStreamConfiguration

async def async_setup_entry(hass, config_entry, async_add_entities):

    device = config_entry.duo_device 
    config = config_entry.duo_config 

    sessions = await device.get_sessions_available()
    # Create switches with device information
    switches = []
    for session in sessions:
        switches.append(DuoStreamSessionSwitch(device, session, config))

    switches.append(DuoStreamSwitch(device,config))
    
    async_add_entities(switches, True)

class DuoStreamSwitch(SwitchEntity):
    def __init__(self, device, config):
        self._device = device
        self._config = config
        self._is_on = None
        self._attr_unique_id = f"{self._config.duo_conf_name}_service_switch"  
      
    @property
    def device_info(self):
        # Create device information for grouping
        return DeviceInfo(
            entry_type=None,
            identifiers={(DOMAIN, self._config.duo_conf_name)},
            manufacturer="DuoStream",
            model="Session Controller",
            name=f"DuoStream {self._config.duo_conf_name}"
        )
    
    @property
    def is_on(self):
        return self._is_on
    
    async def async_turn_on(self, **kwargs):
        await self._device.activate_duo_stream_service(True)
    
    async def async_turn_off(self, **kwargs):
        await self._device.activate_duo_stream_service( False)
    
    async def async_update(self):
        self._is_on = await self._device.get_duostream_service_status()

class DuoStreamSessionSwitch(DuoStreamSwitch):
    def __init__(self, device, session_name, config):
        self._device = device
        self._session_name = session_name
        self._config = config
        self._is_on = None
        self._attr_unique_id = f"{self._config.duo_conf_name}_session_{self._session_name}"

    
    @property
    def is_on(self):
        return self._is_on
    
    async def async_turn_on(self, **kwargs):
        await self._device.change_session_status(self._session_name, True)
    
    async def async_turn_off(self, **kwargs):
        await self._device.change_session_status(self._session_name, False)
    
    async def async_update(self):
        self._is_on = await self._device.get_session_status(self._session_name)
        