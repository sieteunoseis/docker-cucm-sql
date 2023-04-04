-- This Query is for common device configurations:
SELECT
  d.name,
  d.description,
  n.dnorpattern AS DN,
  rp.name AS PARTITION,
  cdc.name AS common_device_config,
  cpp.name AS common_phone_profile
FROM
  device AS d
  INNER JOIN devicenumplanmap AS dnpm ON dnpm.fkdevice = d.pkid
  INNER JOIN numplan AS n ON dnpm.fknumplan = n.pkid
  INNER JOIN routepartition AS rp ON n.fkroutepartition = rp.pkid
  INNER JOIN commondeviceconfig AS cdc ON d.fkcommondeviceconfig = cdc.pkid
  INNER JOIN commonphoneconfig AS cpp ON d.fkcommonphoneconfig = cpp.pkid
  AND d.tkclass = "1"