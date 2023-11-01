SELECT
  mgcp.domainname,
  mgcp.description,
  tp.name,
  d.name AS endpointname,
  d.description AS endpointdescription,
  n.dnorpattern AS DN,
  rp.name AS PARTITION,
  member.slot,
  member.subunit,
  member.port
FROM
  mgcp
  LEFT JOIN typeproduct AS tp ON mgcp.tkproduct = tp.enum
  LEFT JOIN mgcpdevicemember AS member ON mgcp.pkid = member.fkmgcp
  LEFT JOIN device AS d ON member.fkdevice = d.pkid
  LEFT JOIN devicenumplanmap AS dnpm ON dnpm.fkdevice = d.pkid
  LEFT JOIN numplan AS n ON dnpm.fknumplan = n.pkid
  LEFT JOIN routepartition AS rp ON rp.pkid = n.fkroutepartition
WHERE
  mgcp.description LIKE '%%' -- Add your search criteria here