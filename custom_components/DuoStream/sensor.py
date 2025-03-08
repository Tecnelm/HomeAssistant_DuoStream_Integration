# Gestion des capteurs pour suivre l'état des sessions
from homeassistant.components.sensor import SensorEntity
from homeassistant.helpers.device_registry import DeviceEntryType
from homeassistant.helpers.entity import DeviceInfo
from .const import DOMAIN
from .DuoStreamDevice import DuoStreamDevice, DuoStreamConfiguration
import asyncio

async def async_setup_entry(hass, config_entry, async_add_entities):

    device = config_entry.duo_device
    config = config_entry.duo_config 

    sensors = [
        DuoStreamServiceSensor(device,config),
        DuoStreamSessionsSensor(device,config)
    ]
    
    async_add_entities(sensors,True)


class DuoStreamSensor(SensorEntity):
    
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

class DuoStreamServiceSensor(DuoStreamSensor):
    
    def __init__(self, device, config):
        self._device = device
        self._config = config
        self._state = None
        self._icon = "mdi:desktop-tower"
        self._attr_unique_id = f"{self._config.duo_conf_name}_computer_status"  
    
    @property
    def state(self):
        return self._state
    
    @property
    def icon(self):
        """
        Dynamically select the icon based on the current power state.
        Uses Material Design Icons (mdi) prefix.
        """
        return self._icon

    async def async_update(self):
        self._state = "Online" if await self._device.get_power_status_computer() is True else "Offline"


class DuoStreamSessionsSensor(DuoStreamSensor):
    def __init__(self, device, config):
        self._device = device
        self._config = config
        self._sessions = []
        self._attr_unique_id = f"{self._config.duo_conf_name}_available_sessions"  
            
    @property
    def state(self):
        # Return the total number of sessions
        return len(self._sessions)
    
    @property
    def extra_state_attributes(self):
        # Provide the list of available sessions as an attribute
        return {
            "available_sessions": self._sessions
        }
    
    async def async_update(self):
        # Update the list of available sessions
        self._sessions = await self._device.get_sessions_available()



