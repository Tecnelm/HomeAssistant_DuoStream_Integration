import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant,Event
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STOP
import os 

from .DuoStreamDevice import DuoStreamDevice, DuoStreamConfiguration
import asyncio

from .const import DOMAIN,PLATFORMS, DOMAIN, CONF_DUO_IP_ADDRESS, CONF_DUO_PORT, CONF_DUO_HOSTNAME,CONF_DUO_CONF_NAME

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry):
    # Configuration initiale de l'intégration
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    config = DuoStreamConfiguration()
    config.duo_ip_address = entry.data[CONF_DUO_IP_ADDRESS]
    config.duo_port = entry.data[CONF_DUO_PORT]
    config.duo_host_name = entry.data[CONF_DUO_HOSTNAME]
    config.duo_conf_name = entry.data[CONF_DUO_CONF_NAME]
    config.logger = _LOGGER
    config.cache_file = os.path.join(os.path.dirname(__file__),f"duostream_sessions_cache.json")

    entry.duo_device = DuoStreamDevice(configuration=config)
    entry.duo_config = config

    ## Fill the cache 
    loop = asyncio.get_running_loop()
    sessions = await loop.run_in_executor(None, entry.duo_device.read_cached_sessions)


    async def handle_shutdown(event:Event):
        """
        Explicit shutdown handler to ensure data is saved
        """
        try:
            # Retrieve the device
            device = entry.duo_device
            if entry.duo_device:
                # Use run_in_executor to prevent blocking
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, entry.duo_device.write_session_cache)
                _LOGGER.info(f"Sessions cache saved for {DOMAIN} during shutdown")
        
        except Exception as err:
            _LOGGER.error(f"Error during {DOMAIN} shutdown: {err}")

    hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, handle_shutdown)
    
    # Configuration des plateformes
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry):
    # Déchargement de l'intégration
    ## Fill the cache 
    device = entry.duo_device
    loop = asyncio.get_running_loop()
    sessions = await loop.run_in_executor(None, device.write_session_cache)

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok

