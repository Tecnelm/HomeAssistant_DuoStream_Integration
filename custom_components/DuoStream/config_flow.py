# Flux de configuration pour ajouter l'appareil
import voluptuous as vol
from homeassistant.config_entries import ConfigFlow
from .const import DOMAIN, CONF_DUO_IP_ADDRESS, CONF_DUO_PORT, CONF_DUO_HOSTNAME,CONF_DUO_CONF_NAME

class DuoStreamConfigFlow(ConfigFlow, domain=DOMAIN):
    async def async_step_user(self, user_input=None):
        if user_input is not None:
            # Validation et création de l'entrée
            return self.async_create_entry(
                title=user_input[CONF_DUO_CONF_NAME], 
                data=user_input
            )
        
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_DUO_CONF_NAME): str,
                vol.Required(CONF_DUO_IP_ADDRESS): str,
                vol.Required(CONF_DUO_PORT): str,
                vol.Required(CONF_DUO_HOSTNAME): str
            })
        )