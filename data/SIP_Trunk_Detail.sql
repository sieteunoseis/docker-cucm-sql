SELECT
  d.name,
  d.description,
  stcs.name AS siptrunkcalllegsecurity,
  d.mtprequired,
  trp.name AS usetrustedrelaypoint,
  d.retryvideocallasaudio,
  d.srtpallowed,
  stsp.name AS siptrunksecurityprofile,
  dsm.name AS devicesecuritymode,
  sp.name AS sipprofile,
  sp.zzredirectbyapp,
  sp.ringing180,
  sp.enableurioutdialsupport,
  sdpattr.name AS sdpattributelist,
  codecpref.name AS handlingofreceivedoffercodecpreferences,
  sp.inactivesdprequired,
  sp.sendrecvsdpinmidcallinvite,
  rel1xx.name AS rel1xxoptions,
  srm.name AS sipsessionrefreshmethod,
  eo.name AS eosuppvoicecall,
  sp.enableoutboundoptionsping,
  sp.allowpresentationsharingusingbfcp,
  sp.allowixchannel,
  sp.allowmultiplecodecsinanswersdp,
  dtmf.name AS dtmfsignaling,
  d.pstnaccess,
  d.runonallnodes,
  qv.name qsigvariant,
  tp.name AS tunneledprotocol,
  snsprofile.name AS sipnormalizationscript_profile,
  snsdevice.name AS sipnormalizationscript_device
FROM
  sipdevice sd
  INNER JOIN device d ON d.pkid = sd.fkdevice
  INNER JOIN typedtmfsignaling dtmf ON dtmf.enum = d.tkdtmfsignaling
  INNER JOIN typestatus trp ON trp.enum = d.tkstatus_usetrustedrelaypoint
  INNER JOIN typetunneledprotocol tp ON tp.enum = sd.tktunneledprotocol
  INNER JOIN typeqsigvariant qv ON qv.enum = sd.tkqsigvariant
  INNER JOIN typesiptrunkcalllegsecurity stcs ON stcs.enum = sd.tksiptrunkcalllegsecurity
  INNER JOIN securityprofile stsp ON stsp.pkid = d.fksecurityprofile
  INNER JOIN typedevicesecuritymode dsm ON dsm.enum = stsp.tkdevicesecuritymode
  INNER JOIN sipprofile sp ON sp.pkid = d.fksipprofile
  INNER JOIN typestatus codecpref ON codecpref.enum = sp.tkstatus_handlingofreceivedoffercodecpreferences
  INNER JOIN typeeosuppvoicecall eo ON eo.enum = sp.tkeosuppvoicecall
  INNER JOIN typesiprel1xxoptions rel1xx ON rel1xx.enum = sp.tksiprel1xxoptions
  INNER JOIN typesipsessionrefreshmethod srm ON srm.enum = sp.tksipsessionrefreshmethod
  LEFT OUTER JOIN sipnormalizationscript snsprofile ON sp.fksipnormalizationscript = snsprofile.pkid
  LEFT OUTER JOIN sipnormalizationscript snsdevice ON sd.fksipnormalizationscript = snsdevice.pkid
  LEFT OUTER JOIN sdpattributelist sdpattr ON sdpattr.pkid = sp.fksdpattributelist
ORDER BY
  d.name