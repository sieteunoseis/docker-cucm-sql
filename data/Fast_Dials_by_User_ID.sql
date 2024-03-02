SELECT
  uid.userid,
  uid.firstname,
  uid.lastname,
  fd.personalfastdialindex,
  fd.phonenumber AS fastdialdest,
  tppn.name AS TypeofFastDial,
  pab.firstname AS AddressBookFirstName,
  pab.lastname AS AddressBookLastName
FROM
  personalphonebook AS fd
  INNER JOIN enduser AS uid ON fd.fkenduser = uid.pkid
  INNER JOIN typepersonalphonenumber AS tppn ON fd.tkpersonalphonenumber = tppn.enum
  LEFT OUTER JOIN personaladdressbook AS pab ON fd.fkpersonaladdressbook = pab.pkid
ORDER BY
  uid.userid,
  fd.personalfastdialindex