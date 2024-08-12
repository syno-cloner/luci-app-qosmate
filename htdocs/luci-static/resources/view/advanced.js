'use strict';
'require view';
'require form';
'require ui';
'require uci';
'require rpc';

var callInitAction = rpc.declare({
    object: 'luci',
    method: 'setInitAction',
    params: ['name', 'action'],
    expect: { result: false }
});

return view.extend({
    handleSaveApply: function(ev) {
        return this.handleSave(ev)
            .then(() => {
                return ui.changes.apply();
            })
            .then(() => {
                return uci.load('qosmate');
            })
            .then(() => {
                return uci.get_first('qosmate', 'global', 'enabled');
            })
            .then(enabled => {
                if (enabled === '0') {
                    return callInitAction('qosmate', 'stop');
                } else {
                    // Prüfen, ob es Änderungen gab
                    return uci.changes().then(changes => {
                        if (Object.keys(changes).length > 0) {
                            // Es gab Änderungen, also neu starten
                            return callInitAction('qosmate', 'restart');
                        }
                        // Keine Änderungen, nichts tun
                        return Promise.resolve();
                    });
                }
            })
            .then(() => {
                ui.hideModal();
                window.location.reload();
            })
            .catch((err) => {
                ui.hideModal();
                ui.addNotification(null, E('p', _('Failed to save settings or update QoSmate service: ') + err.message));
            });
    },

    render: function() {
        var m, s, o;

        m = new form.Map('qosmate', _('QoSmate Advanced Settings'), _('Configure advanced settings for QoSmate.'));

        s = m.section(form.NamedSection, 'advanced', 'advanced', _('Advanced Settings'));
        s.anonymous = true;

        function createOption(name, title, description, placeholder, datatype) {
            var opt = s.option(form.Value, name, title, description);
            opt.datatype = datatype || 'string';
            opt.rmempty = true;
            opt.placeholder = placeholder;
            
            if (datatype === 'uinteger') {
                opt.validate = function(section_id, value) {
                    if (value === '' || value === null) return true;
                    if (!/^\d+$/.test(value)) return _('Must be a non-negative integer or empty');
                    return true;
                };
            }
            return opt;
        }

        o = s.option(form.Flag, 'PRESERVE_CONFIG_FILES', _('Preserve Config Files'), _('Preserve configuration files during system upgrade'));
        o.rmempty = false;

        o = s.option(form.Flag, 'WASHDSCPUP', _('Wash DSCP Egress'), _('Sets DSCP to CS0 for outgoing packets after classification'));
        o.rmempty = false;

        o = s.option(form.Flag, 'WASHDSCPDOWN', _('Wash DSCP Ingress'), _('Sets DSCP to CS0 for incoming packets before classification'));
        o.rmempty = false;

        createOption('BWMAXRATIO', _('Bandwidth Max Ratio'), _('Max download/upload ratio to prevent upstream congestion'), _('Default: 20'), 'uinteger');
        createOption('ACKRATE', _('ACK Rate'), _('Sets rate limit for TCP ACKs, helps prevent ACK flooding / set to 0 to disable ACK rate limit'), _('Default: 5% of UPRATE'), 'uinteger');

        o = s.option(form.Flag, 'UDP_RATE_LIMIT_ENABLED', _('Enable UDP Rate Limit'), _('Downgrades UDP traffic exceeding 450 pps to lower priority'));
        o.rmempty = false;

        createOption('UDPBULKPORT', _('UDP Bulk Ports'), _('Specify UDP ports for bulk traffic'), _('Default: none'));
        createOption('TCPBULKPORT', _('TCP Bulk Ports'), _('Specify TCP ports for bulk traffic'), _('Default: none'));

        return m.render();
    }
});
