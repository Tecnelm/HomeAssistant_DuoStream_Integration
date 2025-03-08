from homeassistant.const import Platform 

DOMAIN = "DuoStream"
PLATFORMS: list[Platform] = [Platform.SWITCH,Platform.SENSOR]

CONF_DUO_IP_ADDRESS = "duo_ip_address"
CONF_DUO_PORT = "duo_port"
CONF_DUO_HOSTNAME = "duo_host_name"
CONF_DUO_CONF_NAME = "configuration_name"