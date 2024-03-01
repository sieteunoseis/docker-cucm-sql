SELECT
  device.name,
  device.description,
  numplan.dnorpattern AS primary_dn,
  typemodel.name AS device_type,
  commonphoneconfig.name AS common_phone_config,
  typecertificateoperation.name AS certificate_operation,
  CASE
    WHEN device.publickey IS NOT NULL THEN 'yes'
    ELSE 'no'
  END AS certificate_installed
FROM
  device
  JOIN typecertificatestatus ON device.tkcertificatestatus = typecertificatestatus.enum
  JOIN typecertificateoperation ON device.tkcertificateoperation = typecertificateoperation.enum
  JOIN typekeyauthority ON device.tkkeyauthority = typekeyauthority.enum
  JOIN typeclass ON typeclass.enum = device.tkclass
  JOIN typemodel ON typemodel.enum = device.tkmodel
  JOIN devicenumplanmap ON (devicenumplanmap.fkdevice = device.pkid)
  JOIN numplan ON (numplan.pkid = devicenumplanmap.fknumplan)
  JOIN commonphoneconfig ON commonphoneconfig.pkid = device.fkcommonphoneconfig
WHERE
  typeclass.moniker = 'CLASS_PHONE'
  AND typemodel.moniker IN (
    'MODEL_CISCO_7965',
    'MODEL_CISCO_8841',
    'MODEL_CISCO_8851',
    'MODEL_CISCO_8861'
  )
  AND devicenumplanmap.numplanindex = 1